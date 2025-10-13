// src/pages/wsp/WhatsAppHub.jsx
import { useEffect, useState } from "react";
import api from "@/api/axios";                 // baseURL debe ser "/api"
import { useAuth } from "@/context/AuthContext";

export default function WhatsAppHub() {
  const { user } = useAuth();
  const [status, setStatus] = useState("starting"); // string
  const [qr, setQr] = useState(null);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);

  async function startSession() {
    try {
      const { data } = await api.post("/wsp/start");
      // backend ya devuelve status como string
      setStatus(data.status || "starting");
      if (data.status === "scan_qr") await fetchQR();
    } catch (e) {
      console.error("POST /wsp/start error:", e?.response?.data || e);
      setStatus("offline");
    }
  }

  async function fetchQR() {
    try {
      const q = await api.get("/wsp/qr");
      setQr(q?.data?.dataUrl || null);
    } catch (e) {
      console.error("GET /wsp/qr error:", e?.response?.data || e);
      setQr(null);
    }
  }

  async function loadStatus() {
    try {
      const { data } = await api.get("/wsp/status");
      const st = typeof data.status === "string"
        ? data.status
        : data?.status?.status || "starting"; // por si hay un deploy viejo
      setStatus(st);
      if (st === "scan_qr") await fetchQR();
      else setQr(null);
    } catch (e) {
      console.error("GET /wsp/status error:", e?.response?.data || e);
      setStatus("offline");
      setQr(null);
    }
  }

  async function loadLogs() {
    try {
      const { data } = await api.get("/wsp/logs");
      setLogs(data.logs || []);
    } catch (e) {
      console.error("GET /wsp/logs error:", e?.response?.data || e);
    }
  }

  async function loadAdmin() {
    try {
      const { data } = await api.get("/wsp/admin/sessions");
      setSessions(data.sessions || []);
    } catch (e) {
      console.error("GET /wsp/admin/sessions error:", e?.response?.data || e);
    }
  }

  async function send() {
    setMsg("");
    try {
      const { data } = await api.post("/wsp/send", { to, text });
      if (data?.ok) setMsg("✅ Enviado: " + (data.id || ""));
      else setMsg("❌ Error enviando");
    } catch (e) {
      console.error("POST /wsp/send error:", e?.response?.data || e);
      setMsg("❌ " + (e?.response?.data?.error || "Error"));
    }
  }

  async function restart() {
    setMsg("");
    try {
      await api.post("/wsp/restart");
      setMsg("🔄 Reiniciando sesión…");
      setTimeout(loadStatus, 1500);
    } catch (e) {
      console.error("POST /wsp/restart error:", e?.response?.data || e);
      setMsg("❌ " + (e?.response?.data?.error || "Error en restart"));
    }
  }

  useEffect(() => {
    // 1) arrancar la sesión
    startSession();

    // 2) polling
    const s1 = setInterval(loadStatus, 5000);
    const s2 = setInterval(loadLogs, 4000);
    const s3 = setInterval(loadAdmin, 15000);
    return () => { clearInterval(s1); clearInterval(s2); clearInterval(s3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel =
    status === "ready" ? "✅ lista" :
    status === "scan_qr" ? "🔄 escanea el QR" :
    status === "starting" ? "⏳ iniciando…" : "⚠️ offline";

  return (
    <div style={{ maxWidth: 820, margin: "24px auto", fontFamily: "system-ui" }}>
      <h1>WhatsApp Hub {user ? `– ${user?.nombre || user?.email || ""}` : ""}</h1>

      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12, marginBottom: 16 }}>
        <h2>Sesión</h2>
        <p>Estado: {statusLabel}</p>

        {status !== "ready" && (
          <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
            <button onClick={startSession}>Iniciar sesión</button>
            <button onClick={loadStatus}>Actualizar</button>
            <button onClick={restart}>Reiniciar sesión</button>
          </div>
        )}

        {qr && (
          <div>
            <p>Escanea el QR desde <b>WhatsApp &gt; Dispositivos vinculados</b>.</p>
            <img src={qr} alt="QR" style={{ maxWidth: "100%", border: "1px solid #eee", borderRadius: 8 }} />
          </div>
        )}
      </div>

      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2>Enviar mensaje</h2>
        <label>Número (con país, sin +)</label>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="51987654321"
               style={{ display:"block", width:"100%", margin:"6px 0 12px", padding:8 }} />
        <label>Mensaje</label>
        <textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Hola 👋"
                  style={{ display:"block", width:"100%", margin:"6px 0 12px", padding:8 }} />
        <button onClick={send} disabled={status !== "ready"}>Enviar</button>
        <p style={{ marginTop: 8 }}>{msg}</p>
      </div>

      <div style={{ marginTop:16, padding:16, border:"1px solid #ddd", borderRadius:12,
                    maxHeight: 320, overflow:"auto", background:"#0b1020", color:"#cde" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 style={{ margin:0 }}>Logs de sesión</h3>
          <button onClick={loadLogs}>Refrescar</button>
        </div>
        <pre style={{ whiteSpace:"pre-wrap", fontSize:12, marginTop:8 }}>
{logs.join("\n")}
        </pre>
      </div>

      <div style={{ marginTop:16, padding:16, border:"1px solid #ddd", borderRadius:12 }}>
        <h3>Sesiones activas (admin)</h3>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ccc" }}>userId</th>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ccc" }}>ready</th>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ccc" }}>hasClient</th>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ccc" }}>starting</th>
              <th style={{ textAlign:"left", borderBottom:"1px solid #ccc" }}>hasQR</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={i}>
                <td style={{ borderBottom:"1px solid #eee" }}>{s.userId}</td>
                <td style={{ borderBottom:"1px solid #eee" }}>{String(s.ready)}</td>
                <td style={{ borderBottom:"1px solid #eee" }}>{String(s.hasClient)}</td>
                <td style={{ borderBottom:"1px solid #eee" }}>{String(s.starting)}</td>
                <td style={{ borderBottom:"1px solid #eee" }}>{String(s.hasQR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
