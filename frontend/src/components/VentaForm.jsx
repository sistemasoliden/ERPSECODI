// src/components/VentaForm.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

// ...
import api from "../api/axios";

export default function VentaForm({ initialData, onCreated, onSaved }) {
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [error, setError] = useState("");
  const reqIdRef = useRef(0);

  // catálogos
  const [estadosVenta, setEstadosVenta] = useState([]);
  const [tiposVenta, setTiposVenta] = useState([]);
  const [productos, setProductos] = useState([]);

  // usuarios
  const [users, setUsers] = useState([]);

  // selección por ID
  const [selTipoId, setSelTipoId] = useState("");
  const [selProdId, setSelProdId] = useState("");

  const [selConsultorId, setSelConsultorId] = useState("");
  const [selSupervisorId, setSelSupervisorId] = useState("");

  // NUEVOS CAMPOS
  const [q, setQ] = useState("");
  const [cfSinIgv, setCfSinIgv] = useState(""); // input texto
  const cfConIgv = useMemo(() => {
    const n = parseFloat(String(cfSinIgv).replace(",", "."));
    return Number.isFinite(n) ? (n * 1.18).toFixed(2) : "";
  }, [cfSinIgv]);
  // PC FINAL
  const [pcSinIgv, setPcSinIgv] = useState(""); // input manual
  const pcConIgv = useMemo(() => {
    const n = parseFloat(String(pcSinIgv).replace(",", "."));
    return Number.isFinite(n) ? (n * 1.18).toFixed(2) : "";
  }, [pcSinIgv]);
  const [dniConsultor, setDniConsultor] = useState("");
  // debajo de otros useState…
  const [consultoresRegistrados, setConsultoresRegistrados] = useState([]);
  // helper arriba del componente (fuera del efecto)
  const isPDV = (v) => /^\s*s[ií]\s*$/i.test(String(v || ""));

  const [consultorRegistrado, setConsultorRegistrado] = useState("");
  // otros useState...
  const [showSecondContact, setShowSecondContact] = useState(false);

  const [fechaActivacion, setFechaActivacion] = useState(""); // se autollenará si estado = Aprobado
  const [distrito, setDistrito] = useState("");
  const [plan, setPlan] = useState("");
  const [costoEquipo, setCostoEquipo] = useState("");
  const [pdv, setPdv] = useState(false); // marcar PDV
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [dsctoFacturacion, setDsctoFacturacion] = useState("");

  // segmento (desde colección segmentoempresa)
  const [segmentos, setSegmentos] = useState([]);
  const [segmentoId, setSegmentoId] = useState(""); // guardamos _id

  // (opcional) SEC PROYECTO SOT
  const [secProyectoSot, setSecProyectoSot] = useState("");
const mapToTableKeys = (b) => ({
  ...b,
  "ESTADO FINAL": b.estadoFinal,
  "RAZON SOCIAL CLIENTE": b.razonSocial,
  "CF SIN IGV": b.cfSinIgv,
  "CF INC IGV": b.cfConIgv,
  "PC SIN IGV": b.pcSinIgv,
  "PC CON IGV": b.pcConIgv,
  "CONSULTORES": b.CONSULTORES,
  "DNI_CONSULTOR": b.DNI_CONSULTOR,
  "SUPERVISOR": b.SUPERVISOR,
  "CONSULTOR REGISTRADO": b.consultorRegistrado,
  "PLAN": b.plan,
  "DISTRITO": b.distrito,
  "COSTO EQUIPO": b.costoEquipo,
  "Loteo": b.Loteo,
  "Q": b.q,

  // 👇 aquí cambiamos el booleano por un texto
  "PDV": b.pdv ? "Sí" : "",
});


  // ROLES PERMITIDOS
  const ALLOWED_ROLE_IDS = [
    "68a4f22d27e6abe98157a830", // Back Office
    "68a4f22d27e6abe98157a831", // Comercial
    "68a4f22d27e6abe98157a832", // Supervisor Comercial
    "68acded5b9da48dd36769c47", // Postventa
    "68a4f22d27e6abe98157a82f", // Gerencia
  ];
  const SUPERVISOR_ROLE_ID = [
    "68a4f22d27e6abe98157a832",
    "68a4f22d27e6abe98157a82f",
  ];

  const ALLOWED_ROLE_NAMES = [
    "back office",
    "comercial",
    "supervisor comercial",
    "postventa",
    "gerencia",
  ];

  const getRoleId = (u) =>
    (typeof u.role === "string" ? u.role : u.role?._id) || null;

  const getRoleNameLower = (u) =>
    (typeof u.role === "object"
      ? u.role.name || u.role.nombre || u.role.slug || ""
      : ""
    ).toLowerCase();

  const isAllowedConsultor = useCallback((u) => {
    const id = String(getRoleId(u) || "");
    const name = getRoleNameLower(u);
    return ALLOWED_ROLE_IDS.includes(id) || ALLOWED_ROLE_NAMES.includes(name);
  }, []); // 👈 no depende de nada externo

  const isSupervisor = useCallback((u) => {
    const id = String(getRoleId(u) || "");
    const name = getRoleNameLower(u);
    return (
      SUPERVISOR_ROLE_ID.includes(id) ||
      ["supervisor comercial", "gerencia"].includes(name)
    );
  }, []);

  // campos a guardar (labels)
  const [form, setForm] = useState({
    "ESTADO FINAL": "",
    TIPO_V: "",
    PRODUCTO: "",
    TIPO_DE_VENTA: "",
    LINEAS: "",
    CUENTA: "",
    EQUIPO: "",
    SALESFORCE: "",
    Loteo: "",
  });

  // buscar RUC
  const normalizeRuc = (v) => String(v || "").replace(/\D/g, "");
  const buscarRuc = async (value) => {
    const norm = normalizeRuc(value);
    if (norm.length !== 11) {
      setRazonSocial("");
      setError("");
      return;
    }
    const myReqId = ++reqIdRef.current;
    try {
      const { data } = await api.get(`/basesecodi/ruc/${norm}`);
      if (myReqId !== reqIdRef.current) return;
      setRazonSocial(data?.razonSocial || "");
      setError("");
    } catch {
      if (myReqId !== reqIdRef.current) return;
      setRazonSocial("");
      setError("No se encontró el RUC en la base.");
    }
  };
  const handleChangeRuc = (e) => {
    const v = e.target.value;
    setRuc(v);
    setError("");
    buscarRuc(v);
  };

  // seleccionar consultor -> set DNI y "consultor registrado"
  const onChangeConsultor = (e) => {
    const id = e.target.value;
    setSelConsultorId(id);
    const c = consultoresOptionsWithSelected.find((x) => x.id === id);
    setDniConsultor(c?.dni || "");
  };

  // cargar CONSULTOR REGISTRADO (colección separada)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/consultorregistrado");
        // Esperado: [{ _id, nombre, fechaRegistro }, ...]
        setConsultoresRegistrados(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("No pude cargar consultorregistrado:", e);
      }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/segmentoempresa"); // devuelve [{_id, name}, ...]
        setSegmentos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("No pude cargar segmentoempresa:", e);
      }
    })();
  }, []);

  // cargar catálogos
  useEffect(() => {
    (async () => {
      const [est, tv, prods] = await Promise.all([
        api.get("/estadosventa"),
        api.get("/tiposventas"),
        api.get("/productos"),
      ]);
      setEstadosVenta(
        (est.data || []).map((x) => ({
          id: x._id,
          label: x.nombre || x.name || x.slug || "",
          value: x.nombre || x.name || x.slug || "",
        }))
      );
      setTiposVenta(
        (tv.data || [])
          .filter((x) => x.activo !== false)
          .map((x) => ({ id: x._id, label: x.nombre, slug: x.slug }))
      );
      setProductos(
        (prods.data || [])
          .filter((x) => x.activo !== false)
          .map((x) => ({
            id: x._id,
            label: x.nombre,
            slug: x.slug,
            tipoVentaId: String(x.tipoVentaId),
          }))
      );
    })();
  }, []);

  // cargar SOLO usuarios activos
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/activos"); // 👈 nueva ruta
        setUsers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("No pude cargar usuarios activos:", e);
      }
    })();
  }, []);

  const displayName = (u) =>
    u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim();

  const consultoresOptions = useMemo(
    () =>
      (users || [])
        .filter(isAllowedConsultor)
        .map((u) => ({
          id: u._id,
          label: displayName(u),
          dni: u.documentNumber || null,
          role: u.role?.name || u.role?.nombre || u.role?.slug || "",
          email: u.email || "",
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users, isAllowedConsultor]
  );
  const consultoresOptionsWithSelected = useMemo(() => {
    const opts = [...consultoresOptions];
    if (
      initialData &&
      (initialData.consultores || initialData.CONSULTORES) &&
      !opts.some(
        (c) => c.label === (initialData.consultores || initialData.CONSULTORES)
      )
    ) {
      opts.push({
        id: "legacy-consultor",
        label: initialData.consultores || initialData.CONSULTORES,
        dni: initialData.DNI_CONSULTOR || "",
      });
    }
    return opts;
  }, [consultoresOptions, initialData]);

  const supervisoresOptions = useMemo(
    () =>
      (users || [])
        .filter(isSupervisor)
        .map((u) => ({
          id: u._id,
          label: displayName(u),
          email: u.email || "",
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users, isSupervisor]
  );

  const supervisoresOptionsWithSelected = useMemo(() => {
    const opts = [...supervisoresOptions];
    if (
      initialData &&
      (initialData.supervisor || initialData.SUPERVISOR) &&
      !opts.some(
        (s) => s.label === (initialData.supervisor || initialData.SUPERVISOR)
      )
    ) {
      opts.push({
        id: "legacy-supervisor",
        label: initialData.supervisor || initialData.SUPERVISOR,
      });
    }
    return opts;
  }, [supervisoresOptions, initialData]);

  // encadenados
  const productosFiltrados = useMemo(
    () => productos.filter((p) => p.tipoVentaId === selTipoId),
    [productos, selTipoId]
  );

  const onChangeEstado = (e) => {
    const val = e.target.value;
    setForm((p) => ({ ...p, "ESTADO FINAL": val }));
    // siempre hoy, sin importar el estado
    setFechaActivacion(new Date().toISOString().slice(0, 10));
  };

  const onChangeTipo = (e) => {
    const id = e.target.value;
    setSelTipoId(id);
    const tipo = tiposVenta.find((t) => t.id === id);
    setForm((p) => ({
      ...p,
      TIPO_V: tipo?.label || "",
      PRODUCTO: "",
      TIPO_DE_VENTA: "",
    }));
    setSelProdId("");
  };

  const onChangeProducto = (e) => {
    const id = e.target.value;
    setSelProdId(id);
    const prod = productos.find((p) => p.id === id);
    setForm((p) => ({ ...p, PRODUCTO: prod?.label || "", TIPO_DE_VENTA: "" }));
  };

  const hoy = new Date().toISOString().slice(0, 10);

 const handleSubmit = async (e) => {
  e.preventDefault();

  const selConsultor =
    consultoresOptionsWithSelected.find((c) => c.id === selConsultorId) || null;
  const selSupervisor =
    supervisoresOptionsWithSelected.find((s) => s.id === selSupervisorId) || null;

  const base = {
    ruc,
    razonSocial,
    secProyectoSot,
    estadoFinal: form["ESTADO FINAL"],
    tipoV: form.TIPO_V,
    producto: form.PRODUCTO,
    LINEAS: form.LINEAS || "",
    CUENTA: form.CUENTA || "",
    EQUIPO: form.EQUIPO || "",
    SALESFORCE: form.SALESFORCE || "",
    Loteo: form.Loteo || "",
    q,
    cfSinIgv,
    cfConIgv,
    CONSULTORES: selConsultor ? selConsultor.label : undefined,
    DNI_CONSULTOR: selConsultor ? selConsultor.dni ?? null : undefined,
    consultorRegistrado: consultorRegistrado || undefined,
    SUPERVISOR: selSupervisor ? selSupervisor.label : undefined,
    fechaActivacion: fechaActivacion || hoy,
    distrito,
    plan,
    costoEquipo,
    pdv,
    motivoRechazo:
      (form["ESTADO FINAL"] || "").toLowerCase() === "rechazado"
        ? motivoRechazo
        : undefined,
    dsctoFacturacion,
    segmento: segmentoId
      ? segmentos.find((s) => s._id === segmentoId)?.name || ""
      : undefined,
    NOMBRE: form.NOMBRE || undefined,
    CORREO: form.CORREO || undefined,
    NUMERO: form.NUMERO || undefined,
    NOMBRE2: form.NOMBRE2 || undefined,
    CORREO4: form.CORREO4 || undefined,
    NUMERO3: form.NUMERO3 || undefined,
  };

  try {
    if (initialData?._id) {
      // EDITAR
      const updatedVenta = {
        ...initialData,
        ...base,
        ...mapToTableKeys(base),
        _id: initialData._id,
      };

      // 👇 forzamos los campos que la tabla necesita YA
      if (selConsultor) {
        updatedVenta.CONSULTORES = selConsultor.label;
        updatedVenta.DNI_CONSULTOR = selConsultor.dni ?? "";
      }
      if (selSupervisor) {
        updatedVenta.SUPERVISOR = selSupervisor.label;
      }

      onSaved?.(updatedVenta);

      const { data } = await api.put(`/ventas/${initialData._id}`, base);
      console.log("✅ Confirmado desde backend:", data);
    } else {
      // CREAR
      const tempId = Math.random().toString(36).slice(2);
      const tempVenta = {
        ...base,
        ...mapToTableKeys(base),
        _id: tempId,
        fechaIngreso: hoy,
      };

      if (selConsultor) {
        tempVenta.CONSULTORES = selConsultor.label;
        tempVenta.DNI_CONSULTOR = selConsultor.dni ?? "";
      }
      if (selSupervisor) {
        tempVenta.SUPERVISOR = selSupervisor.label;
      }

      onCreated?.(tempVenta);

      const { data } = await api.post("/ventas", { ...base, fechaIngreso: hoy });
      console.log("✅ Confirmado desde backend:", data);
    }
  } catch (err) {
    console.error(err);
    setError("No se pudo guardar la venta.");
  }
};


  // helper para comparar strings flexibles
  const normalizeString = (s = "") =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  // 🔹 Precarga de datos si recibes initialData (editar)
  // arriba del componente
  const didPreload = useRef(false);

  // dentro de VentaForm
  useEffect(() => {
    if (!initialData) return;
    if (tiposVenta.length === 0 || productos.length === 0) return;
    if (
      consultoresOptionsWithSelected.length === 0 ||
      supervisoresOptionsWithSelected.length === 0
    )
      return;
    if (didPreload.current) return;
    didPreload.current = true;

    console.log("📌 Precargando datos:", initialData);

    // ---------------- Tipo Venta ----------------
    const tipoMatch = tiposVenta.find(
      (t) =>
        normalizeString(t.label) === normalizeString(initialData.tipoV) ||
        normalizeString(t.slug) === normalizeString(initialData.tipoV) ||
        t.id === initialData.tipoVentaId
    );
    if (tipoMatch) {
      setSelTipoId(tipoMatch.id);
      setForm((p) => ({ ...p, TIPO_V: tipoMatch.label }));

      const prodMatch = productos.find(
        (p) =>
          p.tipoVentaId === tipoMatch.id &&
          (normalizeString(p.label) === normalizeString(initialData.producto) ||
            normalizeString(p.slug) === normalizeString(initialData.producto) ||
            p.id === initialData.productoId)
      );
      if (prodMatch) {
        setSelProdId(prodMatch.id);
        setForm((p) => ({ ...p, PRODUCTO: prodMatch.label }));
      }
    }

    // ---------------- Datos base ----------------
    setRuc(initialData.ruc || initialData.RUC || "");
    setRazonSocial(
      initialData.razonSocial || initialData["RAZON SOCIAL CLIENTE"] || ""
    );

    // --- Consultor ---
    let selConsultor =
      consultoresOptionsWithSelected.find(
        (c) =>
          normalizeString(c.label) ===
            normalizeString(
              initialData.consultores || initialData.CONSULTORES
            ) || c.id === initialData.consultorId
      ) || null;

    if (!selConsultor && (initialData.consultores || initialData.CONSULTORES)) {
      selConsultor = {
        id: "legacy-consultor",
        label: initialData.consultores || initialData.CONSULTORES,
        dni: initialData.DNI_CONSULTOR || "",
      };
    }

    setSelConsultorId(selConsultor?.id || "");
    setDniConsultor(
      selConsultor?.dni ||
        initialData.dniConsultor ||
        initialData.DNI_CONSULTOR ||
        ""
    );

    // --- Supervisor ---
    let selSupervisor =
      supervisoresOptionsWithSelected.find(
        (s) =>
          normalizeString(s.label) ===
            normalizeString(initialData.supervisor || initialData.SUPERVISOR) ||
          s.id === initialData.supervisorId
      ) || null;

    if (!selSupervisor && (initialData.supervisor || initialData.SUPERVISOR)) {
      selSupervisor = {
        id: "legacy-supervisor",
        label: initialData.supervisor || initialData.SUPERVISOR,
      };
    }

    setSelSupervisorId(selSupervisor?.id || "");

    // --- Consultor Registrado ---
    setConsultorRegistrado(
      initialData.consultorRegistrado ||
        initialData["CONSULTOR REGISTRADO"] ||
        ""
    );

    // Numéricos
    setQ(initialData.q || initialData.Q || "");
    setCfSinIgv(initialData.cfSinIgv || initialData["CF SIN IGV"] || "");
    setPcSinIgv(initialData.pcSinIgv || initialData["PC SIN IGV"] || "");

    // Fechas
    setFechaActivacion(
      initialData.fechaActivacion || initialData.FECHA_ACTIVACION || ""
    );

    // Detalles
    setDistrito(initialData.distrito || initialData.DISTRITO || "");
    setPlan(initialData.plan || initialData.PLAN || "");
    setCostoEquipo(
      initialData.costoEquipo || initialData["COSTO EQUIPO"] || ""
    );

    // dentro del efecto de precarga
    setPdv(isPDV(initialData.pdv) || isPDV(initialData.PDV));

    setMotivoRechazo(
      initialData.motivoRechazo || initialData["MOTIVO RECHAZO"] || ""
    );
    setDsctoFacturacion(
      initialData.dsctoFacturacion || initialData["DSCTO FACTURACION"] || ""
    );
    setSegmentoId(
      segmentos.find(
        (s) => normalizeString(s.name) === normalizeString(initialData.segmento)
      )?._id || ""
    );
    setSecProyectoSot(
      initialData.secProyectoSot || initialData.SEC_PROYECTO_SOT || ""
    );

    // Contactos y otros
    setForm((p) => ({
      ...p,
      "ESTADO FINAL":
        initialData.estadoFinal ||
        initialData["ESTADO FINAL"] ||
        p["ESTADO FINAL"],
      LINEAS: initialData.lineas || initialData.LINEAS || p.LINEAS,
      CUENTA: initialData.cuenta || initialData.CUENTA || p.CUENTA,
      EQUIPO: initialData.equipo || initialData.EQUIPO || p.EQUIPO,
      SALESFORCE:
        initialData.salesforce || initialData.SALESFORCE || p.SALESFORCE,
      Loteo: initialData.loteo || initialData.Loteo || p.Loteo,
      NOMBRE: initialData.nombre || initialData.NOMBRE || p.NOMBRE,
      CORREO: initialData.correo || initialData.CORREO || p.CORREO,
      NUMERO: initialData.numero || initialData.NUMERO || p.NUMERO,
      NOMBRE2: initialData.nombre2 || initialData.NOMBRE2 || p.NOMBRE2,
      CORREO4: initialData.correo4 || initialData.CORREO4 || p.CORREO4,
      NUMERO3: initialData.numero3 || initialData.NUMERO3 || p.NUMERO3,
    }));
  }, [
    initialData,
    tiposVenta,
    productos,
    consultoresOptionsWithSelected,
    supervisoresOptionsWithSelected,
    segmentos,
  ]);

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-2">
      {/* Header */}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {form["ESTADO FINAL"] && (
          <span className="inline-flex items-center gap-2 rounded px-2.5 py-1 text-xs font-medium border text-slate-700 border-slate-200 bg-slate-50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {form["ESTADO FINAL"]}
          </span>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {/* Datos de la Empresa */}

      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-xs uppercase font-medium text-slate-800">
            Datos de la empresa
          </h3>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-12 gap-4 p-5">
          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Fecha de ingreso
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs"
              value={hoy}
              readOnly
            />
          </label>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Fecha de activación
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs"
              value={fechaActivacion || "Pendiente"}
              readOnly
            />
          </label>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Estado final
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
              value={form["ESTADO FINAL"]}
              onChange={onChangeEstado}
            >
              <option value="">— Selecciona —</option>
              {estadosVenta.map((e) => (
                <option key={e.id} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>

          {/* 👇 Solo aparece si Estado final = Rechazado */}
          {form["ESTADO FINAL"]?.toLowerCase() === "rechazado" && (
            <label className="col-span-12 md:col-span-4 text-xs">
              <span className="mb-1 block font-medium text-slate-700">
                Motivo de rechazo
              </span>
              <input
                className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
              />
            </label>
          )}
        </div>

        {/* RUC, Razón Social, Segmento */}
        <div className="grid grid-cols-12 gap-2 px-5 pt-0 pb-5">
          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">RUC</span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={ruc}
              onChange={handleChangeRuc}
              inputMode="numeric"
            />
          </label>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Razón social
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
            />
          </label>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Segmento
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
              value={segmentoId}
              onChange={(e) => setSegmentoId(e.target.value)}
            >
              <option value="">— Selecciona —</option>
              {segmentos.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Asignación */}
      <section className="rounded border border-slate-200 bg-white">
        <div className="grid grid-cols-12 gap-4 p-5">
          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Consultor
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
              value={selConsultorId}
              onChange={onChangeConsultor}
            >
              <option value="">— Selecciona —</option>
              {/* 👇 si el consultor precargado no existe en las opciones, lo mostramos igual */}
              {selConsultorId &&
                !consultoresOptionsWithSelected.some(
                  (c) => c.id === selConsultorId
                ) && (
                  <option value={selConsultorId}>
                    {initialData.consultores || initialData.CONSULTORES}
                  </option>
                )}
              {consultoresOptionsWithSelected.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700 text-c">
              DNI consultor
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs text-center"
              value={dniConsultor}
              readOnly
              placeholder="—"
            />
          </label>

          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Supervisor comercial
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
              value={selSupervisorId}
              onChange={(e) => setSelSupervisorId(e.target.value)}
            >
              <option value="">— Selecciona —</option>

              {/* 👇 si el supervisor precargado no existe en las opciones, lo mostramos igual */}
              {selSupervisorId &&
                !supervisoresOptionsWithSelected.some(
                  (s) => s.id === selSupervisorId
                ) && (
                  <option value={selSupervisorId}>
                    {initialData.supervisor || initialData.SUPERVISOR}
                  </option>
                )}

              {supervisoresOptionsWithSelected.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Consultor registrado
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
              value={consultorRegistrado}
              onChange={(e) => setConsultorRegistrado(e.target.value)}
            >
              <option value="">— Selecciona —</option>
              {consultoresRegistrados.map((c) => (
                <option key={c._id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Información de la Venta */}
      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-xs font-medium text-slate-800">
            Información de la venta
          </h3>
        </div>

        {/* Primera fila (3 columnas iguales) */}
        <div className="grid grid-cols-12 md:grid-cols-3 gap-4 p-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Tipo de venta
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
              value={selTipoId}
              onChange={onChangeTipo}
            >
              <option value="">— Selecciona —</option>
              {tiposVenta.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Producto
            </span>
            <select
              className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs disabled:bg-slate-50"
              value={selProdId}
              onChange={onChangeProducto}
              disabled={!selTipoId}
            >
              <option value="">— Selecciona —</option>
              {productosFiltrados.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">Q</span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>

        {/* Segunda fila (4 columnas iguales) */}
        <div className="grid grid-cols-12 md:grid-cols-4 gap-4 px-5 pb-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              CF sin IGV
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={cfSinIgv}
              onChange={(e) => setCfSinIgv(e.target.value)}
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              CF con IGV
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs"
              value={cfConIgv}
              readOnly
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              PC sin IGV
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={pcSinIgv}
              onChange={(e) => setPcSinIgv(e.target.value)}
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              PC con IGV
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs"
              value={pcConIgv}
              readOnly
            />
          </label>
        </div>
      </section>

      {/* Detalles adicionales */}
      <section className="rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-xs font-medium text-slate-800">
            Detalles adicionales
          </h3>
        </div>

        {/* Primera fila → 4 columnas */}
        <div className="grid grid-cols-12 md:grid-cols-4 gap-4 p-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              SEC PROYECTO SOT
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={secProyectoSot}
              onChange={(e) => setSecProyectoSot(e.target.value)}
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Líneas
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={form.LINEAS}
              onChange={(e) =>
                setForm((p) => ({ ...p, LINEAS: e.target.value }))
              }
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Cuenta
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={form.CUENTA}
              onChange={(e) =>
                setForm((p) => ({ ...p, CUENTA: e.target.value }))
              }
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Equipo
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={form.EQUIPO}
              onChange={(e) =>
                setForm((p) => ({ ...p, EQUIPO: e.target.value }))
              }
            />
          </label>
        </div>

        {/* Segunda fila → 4 columnas */}
        <div className="grid grid-cols-12 md:grid-cols-4 gap-4 px-5 pb-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Salesforce
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={form.SALESFORCE}
              onChange={(e) =>
                setForm((p) => ({ ...p, SALESFORCE: e.target.value }))
              }
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Descuento facturación
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={dsctoFacturacion}
              onChange={(e) => setDsctoFacturacion(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2 text-xs mt-4">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 ml-12 "
              checked={pdv}
              onChange={(e) => setPdv(e.target.checked)}
            />

            <span className="text-center font-medium text-slate-700">PDV</span>
          </div>
        </div>

        {/* Segunda fila → 4 columnas */}
        {/* Segunda fila → 4 columnas */}
        <div className="grid grid-cols-12 md:grid-cols-4 gap-4 px-5 pb-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Distrito
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">Plan</span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Costo Equipo
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={costoEquipo}
              onChange={(e) => setCostoEquipo(e.target.value)}
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">Loteo</span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={form.Loteo}
              onChange={(e) =>
                setForm((p) => ({ ...p, Loteo: e.target.value }))
              }
            />
          </label>
        </div>
      </section>

      {/* Contactos */}
      <section className="rounded border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Contactos
          </h3>
        </div>

        {/* Contacto 1 */}
        <div className="grid grid-cols-12 gap-4 p-5">
          <div className="col-span-12">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Contacto 1
            </p>
          </div>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Nombre
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={form.NOMBRE || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, NOMBRE: e.target.value }))
              }
            />
          </label>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Correo
            </span>
            <input
              type="email"
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={form.CORREO || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, CORREO: e.target.value }))
              }
            />
          </label>

          <label className="col-span-12 md:col-span-4 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Número
            </span>
            <input
              type="tel"
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={form.NUMERO || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, NUMERO: e.target.value }))
              }
            />
          </label>
        </div>

        {/* Contacto 2 */}
        <div className="border-t border-slate-100 px-5 py-4">
          {!showSecondContact ? (
            <button
              type="button"
              onClick={() => setShowSecondContact(true)}
              className="text-xs rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 transition"
            >
              Añadir otro contacto
            </button>
          ) : (
            <div className="grid grid-cols-12 gap-4 pt-2">
              <div className="col-span-12">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Contacto 2
                </p>
              </div>

              <label className="col-span-12 md:col-span-4 text-xs">
                <span className="mb-1 block font-medium text-slate-700">
                  Nombre
                </span>
                <input
                  className="h-9 w-full rounded border border-slate-300 px-3 text-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
                  value={form.NOMBRE2 || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, NOMBRE2: e.target.value }))
                  }
                />
              </label>

              <label className="col-span-12 md:col-span-4 text-xs">
                <span className="mb-1 block font-medium text-slate-700">
                  Correo
                </span>
                <input
                  type="email"
                  className="h-9 w-full rounded border border-slate-300 px-3 text-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
                  value={form.CORREO4 || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, CORREO4: e.target.value }))
                  }
                />
              </label>

              <label className="col-span-12 md:col-span-4 text-xs">
                <span className="mb-1 block font-medium text-slate-700">
                  Número
                </span>
                <input
                  type="tel"
                  className="h-9 w-full rounded border border-slate-300 px-3 text-xs focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
                  value={form.NUMERO3 || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, NUMERO3: e.target.value }))
                  }
                />
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}

      <footer className="bg-white py-3.5">
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 active:translate-y-px"
          >
            Guardar
          </button>
        </div>
      </footer>
    </form>
  );
}
