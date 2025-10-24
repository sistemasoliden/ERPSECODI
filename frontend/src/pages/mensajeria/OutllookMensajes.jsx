import { useEffect, useMemo, useState } from "react";
import api from "@/api/axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";

/** ===== Helpers (fuera del componente) ===== */
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);
const daysBetween = (from, to) => {
  const out = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(fmtDate(d));
  }
  return out;
};

export default function OutlookMensajes() {
  // --- Auth ---
  const [auth, setAuth] = useState({ loggedIn: false, email: "" });
  const [login, setLogin] = useState({ smtpEmail: "", smtpPassword: "" });

  // Cambiar sesión
  const [showSwitch, setShowSwitch] = useState(false);
  const [switchCreds, setSwitchCreds] = useState({
    smtpEmail: "",
    smtpPassword: "",
  });

  // --- Plantillas ---
  const [plantillas, setPlantillas] = useState([]);
  const [tplNombre, setTplNombre] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [editId, setEditId] = useState(null);
  const isEditing = !!editId;

  // --- Stats ---
  const [stats, setStats] = useState([]);
  const hasStats = stats.length > 0;

  const loadAll = async () => {
    // auth persistida o sesión viva
    try {
      const me = await api.get("/correos/me", { withCredentials: true });
      if (me.data?.exists) {
        setAuth({ loggedIn: true, email: me.data.smtpEmail });
      } else {
        const st = await api.get("/auth/smtp/status", {
          withCredentials: true,
        });
        setAuth({ loggedIn: !!st.data?.loggedIn, email: st.data?.email || "" });
      }
    } catch {}

    // plantillas
    try {
      const resTpl = await api.get("/email-templates", {
        withCredentials: true,
      });
      setPlantillas(Array.isArray(resTpl.data?.items) ? resTpl.data.items : []);
    } catch {
      setPlantillas([]);
    }

    // stats
    try {
      const resStats = await api.get("/smtp/stats", { withCredentials: true });
      const rows = (resStats.data?.byDay || []).map((g) => ({
        date: `${g._id.y}-${String(g._id.m).padStart(2, "0")}-${String(
          g._id.d
        ).padStart(2, "0")}`,
        total: g.total,
        ok: g.ok,
        fail: g.fail,
      }));
      setStats(rows);
    } catch {
      setStats([]);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // refresco del gráfico cada 60s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const resStats = await api.get("/smtp/stats", {
          withCredentials: true,
        });
        const rows = (resStats.data?.byDay || []).map((g) => ({
          date: `${g._id.y}-${String(g._id.m).padStart(2, "0")}-${String(
            g._id.d
          ).padStart(2, "0")}`,
          total: g.total,
          ok: g.ok,
          fail: g.fail,
        }));
        setStats(rows);
      } catch {}
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // --------- AUTH handlers ----------
  const conectar = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/smtp/login", login, {
        withCredentials: true,
      });
      await api.post("/correos/me", login, { withCredentials: true });
      setAuth({ loggedIn: true, email: data.email });
      setLogin({ smtpEmail: "", smtpPassword: "" });
      alert("Cuenta conectada y guardada");
    } catch (err) {
      alert(
        "Error de autenticación: " +
          (err?.response?.data?.message || err.message)
      );
    }
  };

  const cambiarSesion = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/smtp/login", switchCreds, {
        withCredentials: true,
      });
      await api.post("/correos/me", switchCreds, { withCredentials: true });
      setAuth({ loggedIn: true, email: data.email });
      setShowSwitch(false);
      setSwitchCreds({ smtpEmail: "", smtpPassword: "" });
      alert("Sesión cambiada ");
      loadAll();
    } catch (err) {
      alert(
        "No se pudo cambiar la sesión: " +
          (err?.response?.data?.message || err.message)
      );
    }
  };

  const borrarCredenciales = async () => {
    if (!confirm("¿Borrar las credenciales guardadas en el servidor?")) return;
    try {
      await api.delete("/correos/me", { withCredentials: true });
      try {
        await api.post("/auth/smtp/logout", {}, { withCredentials: true });
      } catch {}
      setAuth({ loggedIn: false, email: "" });
      alert("Credenciales eliminadas ");
      loadAll();
    } catch (err) {
      alert(
        "No se pudieron borrar: " + (err?.response?.data?.error || err.message)
      );
    }
  };

  // --------- CRUD PLANTILLAS ----------
  const resetForm = () => {
    setTplNombre("");
    setTplSubject("");
    setTplHtml("");
    setEditId(null);
  };

  const guardarPlantilla = async (e) => {
    e.preventDefault();
    if (!tplNombre.trim()) return alert("Ponle un nombre a la plantilla");

    try {
      if (isEditing) {
        await api.put(
          `/email-templates/${encodeURIComponent(editId)}`,
          { name: tplNombre, subject: tplSubject, body: tplHtml },
          { withCredentials: true }
        );
        alert("Plantilla actualizada ");
      } else {
        await api.post(
          "/email-templates",
          { name: tplNombre, subject: tplSubject, body: tplHtml },
          { withCredentials: true }
        );
        alert("Plantilla creada ");
      }
      resetForm();
      loadAll();
    } catch (err) {
      if (err?.response?.status === 401) {
        alert("No autenticado. Conéctate con tu correo SMTP primero.");
      } else {
        alert(
          "Error al guardar: " + (err?.response?.data?.error || err.message)
        );
      }
    }
  };

  const eliminarPlantilla = async (id) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    try {
      await api.delete(`/email-templates/${encodeURIComponent(id)}`, {
        withCredentials: true,
      });
      if (editId === id) resetForm();
      loadAll();
    } catch (err) {
      alert(
        "Error al eliminar: " + (err?.response?.data?.error || err.message)
      );
    }
  };

  const cargarParaEditar = (p) => {
    setEditId(p._id);
    setTplNombre(p.name || "");
    setTplSubject(p.subject || "");
    setTplHtml(p.body || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicarPlantilla = async (p) => {
    try {
      await api.post(
        "/email-templates",
        {
          name: `${p.name} (copia)`,
          subject: p.subject || "",
          body: p.body || "",
        },
        { withCredentials: true }
      );
      loadAll();
    } catch (err) {
      alert(
        "No se pudo duplicar: " + (err?.response?.data?.error || err.message)
      );
    }
  };

  // --------- Derivados para gráficos ----------
  // Ordenados (debe ir antes de dataByDate)
  const statsSorted = useMemo(
    () => [...stats].sort((a, b) => a.date.localeCompare(b.date)),
    [stats]
  );

  // Filtros (rango visible)
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [from, setFrom] = useState(fmtDate(firstOfMonth));
  const [to, setTo] = useState(fmtDate(lastOfMonth));

  // Datos completos (rellenando días faltantes con 0)
  const dataByDate = useMemo(() => {
    const m = new Map((statsSorted || []).map((r) => [r.date, r]));
    return daysBetween(from, to).map((date) => {
      const r = m.get(date);
      return {
        date,
        total: r?.total ?? 0,
        ok: r?.ok ?? 0,
        fail: r?.fail ?? 0,
      };
    });
  }, [statsSorted, from, to]);

  // Promedio de correos enviados (sobre el rango visible)

  // Totales SOLO del rango visible (usa dataByDate)
  const totalsFiltered = useMemo(() => {
    const ok = dataByDate.reduce((acc, r) => acc + (Number(r.ok) || 0), 0);
    const fail = dataByDate.reduce((acc, r) => acc + (Number(r.fail) || 0), 0);
    const total = ok + fail;
    const okPct = total ? Math.round((ok / total) * 100) : 0;
    const failPct = total ? Math.round((fail / total) * 100) : 0;
    return { ok, fail, total, okPct, failPct };
  }, [dataByDate]);

  const donutData = useMemo(
    () => [
      { name: "OK", value: totalsFiltered.ok },
      { name: "FAIL", value: totalsFiltered.fail },
    ],
    [totalsFiltered.ok, totalsFiltered.fail]
  );

  const COLORS = ["#77be91ff", "#8d4545ff"];

  return (
    <div className="p-6 min-h-dvh bg-[#F2F0F0]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* -------- Conectar / Estado SMTP -------- */}
        {!auth.loggedIn ? (
          <form
            onSubmit={conectar}
            className="space-y-2 border p-4 rounded-sm bg-white shadow-md"
          >
            <h2 className="font-bold text-xs mb-1">
              Ingrese sus credenciales de Outlook
            </h2>

            {/* Fila principal: inputs + botón alineado a la derecha */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-6">
              <input
                className="border border-black rounded-lg p-2 text-xs w-full h-10 sm:w-1/3 px-4 placeholder:text-xs mt-2"
                placeholder="Ingrese su correo de Outlook"
                value={login.smtpEmail}
                onChange={(e) =>
                  setLogin({ ...login, smtpEmail: e.target.value })
                }
              />
              <input
                className="border border-black rounded-lg p-2 text-xs w-full h-10 sm:w-1/3 px-4 placeholder:text-xs mt-2"
                type="password"
                placeholder="Ingrese su contraseña"
                value={login.smtpPassword}
                onChange={(e) =>
                  setLogin({ ...login, smtpPassword: e.target.value })
                }
              />
              <div className="flex justify-center w-full sm:w-1/3">
                <button className="px-6 py-2 h-10 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition w-full sm:w-auto">
                  Conectar
                </button>
              </div>
            </div>

            {/* Línea inferior: texto a la derecha */}
            <div className="flex justify-start">
              <p className="text-xs text-black font-semibold text-right mt-2">
                Se guardará para mantener la conexión incluso si la sesión
                expira.
              </p>
            </div>
          </form>
        ) : (
          <div className="space-y-3 border p-4 rounded-lg bg-white shadow-md">
            <div className="flex items-center justify-between gap-4 min-h-[56px]">
              {/* Texto de estado */}
              <div className="flex flex-col justify-center text-sm leading-tight">
                <div>
                  Conectado como — <b>{auth.email}</b>
                </div>
                <p className="text-green-900 mt-2 font-bold text-[12px]">
                  Su cuenta de Outlook está conectada y lista para enviar
                  correos.
                </p>
              </div>

              {/* Botones */}
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center justify-center h-10 w-28 rounded-lg border border-black text-black text-xs font-medium hover:bg-gray-50 transition"
                  onClick={() => setShowSwitch((s) => !s)}
                >
                  {showSwitch ? "Ocultar" : "Cambiar sesión"}
                </button>

                <button
                  className="inline-flex items-center justify-center h-10 w-28 rounded-lg border border-red-900 text-red-900 text-xs font-medium hover:bg-red-50 transition"
                  onClick={borrarCredenciales}
                >
                  Quitar Accesos
                </button>
              </div>
            </div>

            {showSwitch && (
              <form
                onSubmit={cambiarSesion}
                className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t pt-3"
              >
                <input
                  className="border border-black rounded-lg p-2 text-xs w-full h-10 sm:w-1/3 px-4 placeholder:text-xs"
                  placeholder="Ingrese nuevo correo"
                  value={switchCreds.smtpEmail}
                  onChange={(e) =>
                    setSwitchCreds({
                      ...switchCreds,
                      smtpEmail: e.target.value,
                    })
                  }
                />

                <input
                  className="border border-black rounded-lg p-2 text-xs h-10 w-full sm:w-1/3 px-4 placeholder:text-xs"
                  type="password"
                  placeholder="Ingrese nueva contraseña"
                  value={switchCreds.smtpPassword}
                  onChange={(e) =>
                    setSwitchCreds({
                      ...switchCreds,
                      smtpPassword: e.target.value,
                    })
                  }
                />

                <div className="flex justify-end w-full sm:w-1/3">
                  <button className="px-6 py-2 h-10 rounded-lg border border-indigo-900 text-indigo-900 text-sm font-medium  transition w-full sm:w-auto">
                    Aplicar cambio de sesión
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* -------- Plantillas -------- */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Editor/creador */}
          <form
            onSubmit={guardarPlantilla}
            className="space-y-3 border p-4 rounded-lg bg-white shadow-md"
          >
            <div className="flex items-center justify-between mt-2">
              <h2 className="font-bold text-sm">
                {isEditing ? "Editar plantilla" : "Crear plantilla"}
              </h2>
              {isEditing && (
                <button
                  type="button"
                  className="text-sm text-indigo-600"
                  onClick={resetForm}
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <input
              className="border p-2 border-black rounded rounded-lg text-sm w-full px-4 "
              placeholder="Nombre de plantilla"
              value={tplNombre}
              onChange={(e) => setTplNombre(e.target.value)}
            />
            <input
              className="border p-2 border-black rounded rounded-lg text-sm w-full px-4"
              placeholder="Asunto "
              value={tplSubject}
              onChange={(e) => setTplSubject(e.target.value)}
            />
            <textarea
              className="border p-2 border-black rounded rounded-lg w-full h-40 font-arial text-sm px-4 py-4"
              placeholder="HTML de la plantilla"
              value={tplHtml}
              onChange={(e) => setTplHtml(e.target.value)}
            />

            <div className="flex justify-center items-center gap-3">
              <button className="px-4 py-2 rounded border border-indigo-600 text-indigo-600 w-48 text-center">
                {isEditing ? "Actualizar" : "Guardar "}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded border w-48 border-black text-black text-center"
                onClick={() =>
                  setTplHtml(
                    (h) =>
                      `${h}${
                        h ? "\n\n" : ""
                      }<!-- VARIABLES DISPONIBLES: {{nombre}}, {{empresa}}, {{ejecutivo}} -->`
                  )
                }
              >
                Variables
              </button>
            </div>

            {/* Previsualización simple */}
            <div className="mt-3">
              <h3 className="font-bold mb-1 text-sm text-gray-900">
                Previsualización
              </h3>
              <div className="border border-green-900 rounded rounded-lg p-3 text-sm overflow-auto h-40 px-4 py-4">
                <div
                  dangerouslySetInnerHTML={{
                    __html: tplHtml
                      .replaceAll("{{nombre}}", "<i>Nombre</i>")
                      .replaceAll("{{empresa}}", "<i>Empresa</i>")
                      .replaceAll("{{ejecutivo}}", "<i>Ejecutivo</i>"),
                  }}
                />
              </div>
            </div>
          </form>

          {/* Listado */}
          <div className="space-y-3 border p-4 rounded-lg bg-white shadow-md">
            <h2 className="font-semibold text-sm">Mis plantillas</h2>
            <ul className="divide-y">
              {plantillas.map((p) => (
                <li
                  key={p._id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold uppercase text-xs">
                      {p.name}
                    </div>
                    {!!p.subject && (
                      <div className="text-xs text-gray-500">
                        Asunto: {p.subject}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 truncate">
                      {String(p.body || "")
                        .replace(/<[^>]+>/g, "")
                        .slice(0, 120) || "—"}
                    </div>
                    <div className="mt-2 flex gap-3">
                      <button
                        className="text-indigo-700 text-sm "
                        onClick={() => cargarParaEditar(p)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-sky-700 text-sm "
                        onClick={() => duplicarPlantilla(p)}
                      >
                        Duplicar
                      </button>
                      <button
                        className="text-red-600 text-sm "
                        onClick={() => eliminarPlantilla(p._id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {plantillas.length === 0 && (
                <li className="text-gray-500 text-sm">Sin plantillas.</li>
              )}
            </ul>
          </div>
        </div>

        {/* -------- Gráficos (2–1 en la misma fila) -------- */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Línea (2 columnas) */}
          <div className="md:col-span-2 border p-4 rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm mt-2 text-blue-800 ml-8">
                Mensajes enviados
              </h2>
              {!hasStats && (
                <span className="text-xs text-gray-500">
                  Aún no hay datos (o no está habilitado{" "}
                  <code>/smtp/stats</code>).
                </span>
              )}
            </div>

            {/* Filtros: desde / hasta */}
            <div className="flex justify-end items-end gap-2 mb-3 mr-6">
              <label className="text-sm flex flex-col">
                <span className="block text-gray-900 text-xs mb-1 text-right">
                  Desde
                </span>
                <input
                  type="date"
                  className="border  border-black rounded px-2 py-2 w-28 text-xs"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm flex flex-col">
                <span className="block text-gray-900 text-xs  mb-1 text-right ">
                  Hasta
                </span>
                <input
                  type="date"
                  className="border border-black rounded px-2 py-2 w-28 text-xs"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>

            <div className="h-72 px-[3px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dataByDate}
                  margin={{ top: 20, right: 20, left: -30, bottom: 20 }} // separación lateral exacta
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    ticks={dataByDate.map((d) => d.date)}
                    interval={0}
                    tick={{ fontSize: 9, fontWeight: "bold", fill: "black" }}
                    tickFormatter={(v) => v.slice(8, 10)}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      textAlign: "center",
                      backgroundColor: "white",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      color: "black",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "black", fontWeight: "bold" }}
                    formatter={(value) => [`Total: ${value}`, ""]}
                    labelFormatter={(v) => `Fecha: ${v}`}
                  />
                  <Legend />
                  {/* Línea de promedio */}

                  <Line
                    type="monotone"
                    dataKey="total"
                    strokeWidth={1.5}
                    stroke="#af0c0eff"
                    name="Total"
                    dot={{ r: 2 }}
                    activeDot={{ r: 6 }}
                    label={{
                      position: "top", // coloca el número encima del punto
                      dy: -4, // ajusta altura (negativo = más arriba)
                      fontSize: 9,
                      fill: "black",
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dona (1 columna) */}
          <div className="md:col-span-1 border p-4 rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between mb-3 mt-2">
              <h2 className="font-bold text-blue-800 text-sm ml-4">
                {" "}
                Distribucion estado de envio
              </h2>
              <div className="text-xs text-gray-900 font-bold mr-2 ">
                Total - <b>{totalsFiltered.total}</b>
              </div>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 25, bottom: 0 }}>
                  {" "}
                  {/* 🔹 agrega espacio abajo */}
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="42%"
                    outerRadius="85%"
                    paddingAngle={8}
                    cornerRadius={10}
                    labelLine={false} // sin línea
                    label={({
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                      value,
                    }) => {
                      const RADIAN = Math.PI / 180;
                      const radius =
                        innerRadius + (outerRadius - innerRadius) / 2;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);

                      return (
                        <text
                          x={x}
                          y={y}
                          fill="black" // color del texto dentro del segmento
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={11}
                          fontWeight="bold"
                        >
                          {value}
                        </text>
                      );
                    }}
                  >
                    {donutData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                      padding: "8px 12px",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => {
                      const color = name === "OK" ? "#000000ff" : "#5d0202ff"; // verde o rojo
                      const label =
                        name === "OK"
                          ? ` Correctos (${totalsFiltered.okPct}%)`
                          : ` Fallidos (${totalsFiltered.failPct}%)`;
                      return [
                        <span style={{ color, fontWeight: 600 }}>{value}</span>,
                        <span style={{ color }}>{label}</span>,
                      ];
                    }}
                    labelStyle={{
                      color: "#1f2937",
                      fontWeight: "bold",
                      fontSize: "13px",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{
                      fontSize: "12px",
                      marginTop: "30px", // 🔹 solo separa la leyenda visualmente, sin reducir el gráfico
                      position: "relative",
                      fontWeight: "bold",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* /Gráficos */}
      </div>
    </div>
  );
}
