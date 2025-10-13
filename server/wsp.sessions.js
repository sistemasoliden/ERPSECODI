// server/wsp.sessions.js
import qrcode from "qrcode";
import wweb from "whatsapp-web.js";
const { Client, LocalAuth } = wweb;

/* ================= CONFIG ================= */
const AUTH_DIR   = process.env.WWEBJS_DATA_DIR || ".wwebjs_auth";
const CHROME_BIN = process.env.PUPPETEER_EXECUTABLE_PATH || (
  process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome"
);
const VERBOSE    = String(process.env.WSP_VERBOSE || "") === "1";

/* =============== ESTADO =============== */
const SESSIONS = new Map(); // userId -> { client, ready, lastQR, starting, logoutIntent }
const LOGS     = new Map(); // userId -> string[]

const ts = () => new Date().toISOString().replace("T"," ").replace("Z","");
function log(userId, ...parts) {
  const line = `[${ts()}] [${userId}] ${parts.join(" ")}`;
  if (!LOGS.has(userId)) LOGS.set(userId, []);
  const buf = LOGS.get(userId);
  buf.push(line); if (buf.length > 4000) buf.splice(0, buf.length - 4000);
  console.log(line);
}
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

/* =============== CLIENT FACTORY =============== */
function buildClient(userId) {
  return new Client({
    authStrategy: new LocalAuth({ clientId: `wsp-${userId}`, dataPath: AUTH_DIR }),
    webVersion: undefined,
    webVersionCache: {
      type: "remote",
      remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/last.json",
    },
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    qrMaxRetries: Infinity,
    puppeteer: {
      headless: true,              // cámbialo a false si quieres ver la ventana
      executablePath: CHROME_BIN,
      protocolTimeout: 180000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-features=TranslateUI,AutomationControlled,site-per-process",
        "--disable-extensions",
      ],
    },
  });
}

/* =============== WIRING EVENTOS =============== */
function wireEvents(userId, client, state) {
  client.on("qr", async code => {
    state.lastQR = await qrcode.toDataURL(code).catch(() => null);
    state.ready = false;
    log(userId, "📲 QR listo");
  });

  client.on("authenticated", () => log(userId, "🔐 authenticated"));
  client.on("ready", () => { state.ready = true; state.lastQR = null; log(userId, "✅ ready"); });
  client.on("auth_failure", (m)=>{ state.ready=false; log(userId, "❌ auth_failure", String(m||"")); });

  client.on("disconnected", async (reason) => {
    const r = String(reason || "").toUpperCase();
    log(userId, "🔌 disconnected:", r || "(sin razón)");
    state.ready = false; state.lastQR = null;

    // no reiniciar si fue un logout explícito
    if (state.logoutIntent || r === "LOGOUT") {
      log(userId, "🛑 no-auto-restart (LOGOUT) – espera /relogin");
      state.logoutIntent = false;
      try { await client.destroy().catch(()=>{}); } catch {}
      state.client = null;
      return;
    }

    // cualquier otro motivo => autorestart
    try { await client.destroy().catch(()=>{}); } catch {}
    state.client = null;
    await sleep(1500);
    ensure(userId, true).catch(e => log(userId, "restart error:", e?.message || e));
  });

  if (VERBOSE) {
    client.on("message_create", (m)=> log(userId, "message_create", (m.body||"").slice(0,120)));
    client.on("message", (m)=> log(userId, "message_in", (m.body||"").slice(0,120)));
  }
}

/* =============== API =============== */
export async function ensure(userId, force=false) {
  if (!userId) throw new Error("Falta userId");
  let st = SESSIONS.get(userId);
  if (!st) { st = { client:null, ready:false, lastQR:null, starting:false, logoutIntent:false }; SESSIONS.set(userId, st); }
  if (st.client && !force) return st;
  if (st.starting && !force) return st;

  st.starting = true;
  log(userId, `Inicializando whatsapp-web.js (${CHROME_BIN})`);
  try {
    if (st.client) { try { await st.client.destroy().catch(()=>{}); } catch {} }
    const client = buildClient(userId);
    st.client = client; st.ready = false; st.lastQR = null;
    client.removeAllListeners();
    wireEvents(userId, client, st);
    await client.initialize();
  } catch (e) {
    log(userId, "Init error:", e?.message || String(e));
    try { await st.client?.destroy?.().catch(()=>{}); } catch {}
    st.client = null;
  } finally { st.starting = false; }
  return st;
}

export function status(userId) {
  const st = SESSIONS.get(userId);
  if (!st) return { status: "starting" };
  if (st.ready) return { status: "ready" };
  if (st.lastQR) return { status: "scan_qr" };
  return { status: "starting" };
}

export function qr(userId) {
  const st = SESSIONS.get(userId);
  return st?.lastQR || null;
}

function normalizeNumber(input) {
  const digits = String(input || "").replace(/[^\d]/g, "");
  if (!digits) throw new Error("Número inválido");
  return `${digits}@c.us`;
}

export async function send(userId, to, text) {
  const st = SESSIONS.get(userId);
  if (!st?.client) throw new Error("Sesión no inicializada");
  if (!st.ready)   throw new Error("Sesión no lista");
  const jid = normalizeNumber(to);
  const res = await st.client.sendMessage(jid, text);
  log(userId, "sendMessage", jid);
  return res;
}

export async function restart(userId) {
  const st = SESSIONS.get(userId);
  if (!st?.client) { await ensure(userId, true); return; }
  log(userId, "♻️ restart");
  try { await st.client.destroy().catch(()=>{}); } catch {}
  st.client = null; st.ready=false; st.lastQR=null;
  await sleep(800);
  await ensure(userId, true);
}

export async function logout(userId) {
  const st = SESSIONS.get(userId);
  if (!st?.client) return;
  st.logoutIntent = true;
  log(userId, "🚪 logout");
  try { await st.client.logout().catch(()=>{}); } catch {}
  try { await st.client.destroy().catch(()=>{}); } catch {}
  st.client = null; st.ready=false; st.lastQR=null;
}

export async function relogin(userId) {
  const st = SESSIONS.get(userId) || { logoutIntent:false };
  st.logoutIntent = false;
  SESSIONS.set(userId, st);
  await ensure(userId, true);
}

export function getLogs(userId) { return LOGS.get(userId) || []; }
export function listSessions() {
  const out = [];
  for (const [userId, s] of SESSIONS.entries()) {
    out.push({ userId, ready:!!s.ready, hasClient:!!s.client, starting:!!s.starting, hasQR:!!s.lastQR });
  }
  return out;
}
