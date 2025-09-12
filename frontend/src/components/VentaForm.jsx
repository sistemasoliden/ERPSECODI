// src/components/VentaForm.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

import api from "../api/axios";

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "— Selecciona —",
  disabled = false,
  getOptionValue = (o) => o.id,
  getOptionLabel = (o) => o.label,
  className = "",
  buttonClassName = "",
}) {
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef(null);

  React.useEffect(() => {
    const onDocClick = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected =
    options.find((o) => String(getOptionValue(o)) === String(value)) || null;

  return (
    <div
      ref={boxRef}
      className={`relative ${
        disabled ? "opacity-60 pointer-events-none" : ""
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "h-9 w-full rounded border border-slate-300 bg-white px-3 pr-9 text-left text-xs",
          "whitespace-nowrap truncate focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-900",
          buttonClassName,
        ].join(" ")}
      >
        {selected ? (
          getOptionLabel(selected)
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
      </button>

      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        ▼
      </span>

      <div
        className={[
          // 👇 tu mismo estilo
          "absolute left-0 top-full z-50 mt-1 w-full border border-slate-200 bg-white shadow-lg",
          "transform origin-top transition duration-150",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
      >
        <div className="max-h-56 overflow-y-auto text-xs">
          {/* opción vacía */}
          <div
            // opción vacía
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange("");
              setOpen(false);
            }}
            className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
              !value ? "bg-slate-100" : ""
            }`}
          >
            — Selecciona —
          </div>

          {options.map((o) => {
            const val = String(getOptionValue(o));
            const label = getOptionLabel(o);
            const active = String(value) === val;
            return (
              <div
                key={val}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(val);
                  setOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                  active ? "bg-slate-100" : ""
                }`}
                title={label}
              >
                <span className="block w-full truncate">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function VentaForm({ initialData, onCreated, onSaved }) {
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [setError] = useState("");
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

  // --- CF de doble vía ---
  const [cfSinIgv, setCfSinIgv] = useState("");
  const [cfConIgv, setCfConIgv] = useState("");

  // PC FINAL (lo de antes)

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

  const [equipos, setEquipos] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const equipoBoxRef = useRef(null);

  const [isOpenConsultor, setIsOpenConsultor] = useState(false);
  const consultorBoxRef = useRef(null);
  const [planes, setPlanes] = useState([]);
  const [isOpenPlan, setIsOpenPlan] = useState(false);
  const planBoxRef = useRef(null);
  const [isOpenSupervisor, setIsOpenSupervisor] = useState(false);
  const supervisorBoxRef = useRef(null);

  // Descuentos fijos del combo
  // Descuentos fijos del combo
  const DESCUENTOS = [
    0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80,
  ];

  const DESCUENTOS_PDV = [0, 50];

  const descuentosDisponibles = useMemo(
    () => (pdv ? DESCUENTOS_PDV : DESCUENTOS),
    [pdv]
  );

  // ¿Ventas Móviles?
  const isVentasMoviles = useMemo(() => {
    const label = (
      tiposVenta.find((t) => t.id === selTipoId)?.label || ""
    ).toLowerCase();
    return label.includes("movil") || label.includes("móvil");
  }, [selTipoId, tiposVenta]);

  // Extrae el último número del texto del plan (69.90, 289.90, etc.)
  // (si ya tienes esta función, no la dupliques)
  const extractPlanPrice = (name) => {
    if (!name) return null;
    const m = String(name).match(/([0-9]+(?:[.,][0-9]+)?)\s*$/);
    if (!m) return null;
    const num = parseFloat(m[1].replace(",", "."));
    return Number.isFinite(num) ? num : null;
  };

  // Precio base del plan (CON IGV) si aplica
  const basePlanConIgv = useMemo(() => {
    if (!isVentasMoviles) return null;
    const price = extractPlanPrice(plan);
    return price ?? null;
  }, [isVentasMoviles, plan]);

  const basePlanSinIgv = useMemo(() => {
    return basePlanConIgv != null ? basePlanConIgv / 1.18 : null;
  }, [basePlanConIgv]);

  // Base para calcular descuento (prioriza el número del Plan; si no, CF con IGV manual)
  const baseDsctoConIgv = useMemo(() => {
    const fromPlan = extractPlanPrice(plan);
    if (fromPlan != null) return fromPlan;
    const n = parseFloat(String(cfConIgv).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }, [plan, cfConIgv]);

  // Por claridad, calcula el % una sola vez
  const pctNum = useMemo(
    () => parseFloat(dsctoFacturacion) || 0,
    [dsctoFacturacion]
  );

  // CF con descuento (CON IGV)
  const cfDsctoConIgv = useMemo(() => {
    if (baseDsctoConIgv == null) return null;
    return baseDsctoConIgv * (1 - pctNum / 100);
  }, [baseDsctoConIgv, pctNum]);

  // CF con descuento (SIN IGV)
  const cfDsctoSinIgv = useMemo(() => {
    return cfDsctoConIgv != null ? cfDsctoConIgv / 1.18 : null;
  }, [cfDsctoConIgv]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!consultorBoxRef.current?.contains(e.target))
        setIsOpenConsultor(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (isVentasMoviles) {
      setDsctoFacturacion((prev) => (prev ? prev : "50"));
    } else {
      setDsctoFacturacion("");
    }
  }, [isVentasMoviles]);
  useEffect(() => {
    const onDocClick = (e) => {
      if (!supervisorBoxRef.current?.contains(e.target))
        setIsOpenSupervisor(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Cuando hay plan válido, CF base = plan original (sin descuento)
  useEffect(() => {
    if (basePlanSinIgv != null) {
      setCfSinIgv(basePlanSinIgv.toFixed(2)); // cfConIgv se actualiza con tu useMemo
    }
  }, [basePlanSinIgv]);

  // cargar planes desde backend
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ventas-planes");
        setPlanes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("No pude cargar ventasplanes:", e);
      }
    })();
  }, []);

  // cerrar al hacer click fuera
  useEffect(() => {
    const onDocClick = (e) => {
      if (!planBoxRef.current?.contains(e.target)) setIsOpenPlan(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // 👉 Si PDV está OFF, refleja el descuento elegido en CF (con y sin IGV).

  const mapToTableKeys = (b) => ({
    ...b,
    "ESTADO FINAL": b.estadoFinal,
    "RAZON SOCIAL CLIENTE": b.razonSocial,
    "CF SIN IGV": b.cfSinIgv,
    "CF INC IGV": b.cfConIgv,
    "CF FACTURACION DSCTO SIN IGV": b.cfDescSinIgv, // 👈 nuevo
    "CF FACTURACION DSCTO CON IGV": b.cfDescConIgv, // 👈 nuevo

    CONSULTORES: b.CONSULTORES,
    DNI_CONSULTOR: b.DNI_CONSULTOR,
    SUPERVISOR: b.SUPERVISOR,
    "CONSULTOR REGISTRADO": b.consultorRegistrado,
    PLAN: b.plan,
    DISTRITO: b.distrito,
    "COSTO EQUIPO": b.costoEquipo,
    Loteo: b.Loteo,
    Q: b.q,
    PDV: b.pdv ? "Sí" : "",
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

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ventas-equipos");
        setEquipos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("No pude cargar ventasequipos:", e);
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
  // Cuando cambia el plan y termina en número, CF = plan (con IGV) y sin IGV
  useEffect(() => {
    const price = extractPlanPrice(plan);
    if (price != null) {
      setCfConIgv(price.toFixed(2));
      setCfSinIgv((price / 1.18).toFixed(2));
    }
  }, [plan]);

  // Si enciendes PDV y no hay descuento, pon 50%. Si apagas PDV, el descuento no se aplica.
  useEffect(() => {
    if (pdv && !dsctoFacturacion) setDsctoFacturacion("50");
  }, [pdv, dsctoFacturacion]);

  useEffect(() => {
    if (pdv) {
      // Si el % actual no es 0 o 50, forzar 50
      if (!DESCUENTOS_PDV.includes(Number(dsctoFacturacion || 0))) {
        setDsctoFacturacion("50");
      }
      // Fijar CF base al precio del plan (sin descuento) si existe
      const price = extractPlanPrice(plan);
      if (price != null) {
        setCfConIgv(price.toFixed(2));
        setCfSinIgv((price / 1.18).toFixed(2));
      }
    }
  }, [pdv, plan, dsctoFacturacion]);
  useEffect(() => {
    if (!pdv) {
      const planPrice = extractPlanPrice(plan);
      // Solo aplicamos esta “auto-sincronización” si hay plan con precio
      // para evitar ciclos cuando la base es un valor manual.
      if (planPrice != null && cfDsctoConIgv != null) {
        const tgtCon = cfDsctoConIgv.toFixed(2);
        const tgtSin = (cfDsctoConIgv / 1.18).toFixed(2);

        if (cfConIgv !== tgtCon || cfSinIgv !== tgtSin) {
          setCfConIgv(tgtCon);
          setCfSinIgv(tgtSin);
        }
      }
    }
  }, [pdv, plan, cfDsctoConIgv, cfConIgv, cfSinIgv]);

  // Base para calcular descuento (prioriza el número del Plan; si no, CF con IGV manual)

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

  const onChangeCfSinIgv = (e) => {
    const v = e.target.value;
    setCfSinIgv(v);
    const n = parseFloat(String(v).replace(",", "."));
    if (Number.isFinite(n)) setCfConIgv((n * 1.18).toFixed(2));
    else setCfConIgv("");
  };

  const onChangeCfConIgv = (e) => {
    const v = e.target.value;
    setCfConIgv(v);
    const n = parseFloat(String(v).replace(",", "."));
    if (Number.isFinite(n)) setCfSinIgv((n / 1.18).toFixed(2));
    else setCfSinIgv("");
  };

  const hoy = new Date().toISOString().slice(0, 10);

  const _cfDescConIgv = cfDsctoConIgv != null ? cfDsctoConIgv.toFixed(2) : "";
  const _cfDescSinIgv = cfDsctoSinIgv != null ? cfDsctoSinIgv.toFixed(2) : "";

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selConsultor =
      consultoresOptionsWithSelected.find((c) => c.id === selConsultorId) ||
      null;
    const selSupervisor =
      supervisoresOptionsWithSelected.find((s) => s.id === selSupervisorId) ||
      null;

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
      cfDescSinIgv: _cfDescSinIgv, // 👈 nuevo (informativo)
      cfDescConIgv: _cfDescConIgv,
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

        const { data } = await api.post("/ventas", {
          ...base,
          fechaIngreso: hoy,
        });
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
            <CustomSelect
              value={form["ESTADO FINAL"]}
              onChange={(val) => {
                setForm((p) => ({ ...p, "ESTADO FINAL": val }));
                setFechaActivacion(new Date().toISOString().slice(0, 10));
              }}
              options={estadosVenta} // [{id,label,value}]
              getOptionValue={(o) => o.value}
              getOptionLabel={(o) => o.label}
            />
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
            <CustomSelect
              value={segmentoId}
              onChange={(val) => setSegmentoId(val)}
              options={segmentos} // [{_id, name}]
              getOptionValue={(o) => o._id}
              getOptionLabel={(o) => o.name}
            />
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

            <div ref={consultorBoxRef} className="relative">
              {/* Botón (muestra el valor actual) */}
              <button
                type="button"
                onClick={() => setIsOpenConsultor((v) => !v)}
                className="h-9 w-full rounded border border-slate-300 bg-white px-3 pr-9
                 text-left text-xs whitespace-nowrap truncate
                 focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-900
                 transition hover:shadow-sm active:scale-[.99]"
              >
                {selConsultorId ? (
                  consultoresOptionsWithSelected.find(
                    (c) => c.id === selConsultorId
                  )?.label ||
                  initialData?.consultores ||
                  initialData?.CONSULTORES
                ) : (
                  <span className="text-slate-400">— Selecciona —</span>
                )}
              </button>

              {/* Flecha */}
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </span>

              {/* Menú superpuesto con animación (no empuja layout) */}
              <div
                className={[
                  "absolute left-0 top-full z-50 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg",
                  "transform origin-top transition duration-150 ease-out",
                  isOpenConsultor
                    ? "opacity-100 scale-100 pointer-events-auto"
                    : "opacity-0 scale-95 pointer-events-none",
                ].join(" ")}
              >
                <div className="max-h-56 overflow-y-auto text-xs">
                  {/* opción vacía */}
                  {/* opción vacía */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation(); // ⛔️ evita que el click llegue al botón trigger
                      setSelConsultorId("");
                      setDniConsultor("");
                      setIsOpenConsultor(false);
                    }}
                    className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                      !selConsultorId ? "bg-slate-100" : ""
                    }`}
                  >
                    — Selecciona —
                  </div>

                  {/* opciones reales */}
                  {consultoresOptionsWithSelected.map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // ⛔️
                        setSelConsultorId(c.id);
                        setDniConsultor(c.dni || "");
                        setIsOpenConsultor(false);
                      }}
                      className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                        selConsultorId === c.id ? "bg-slate-100" : ""
                      }`}
                      title={c.label}
                    >
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </label>

          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              DNI consultor
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs text-center"
              value={dniConsultor}
              readOnly
              placeholder="—"
            />
          </label>
          {/*supervisor*/}
          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Supervisor comercial
            </span>

            {/* ✅ Tu select original oculto: conserva toda la funcionalidad/legacy */}
            <select
              className="sr-only absolute opacity-0 pointer-events-none"
              aria-hidden="true"
              tabIndex={-1}
              value={selSupervisorId}
              onChange={(e) => setSelSupervisorId(e.target.value)}
            >
              <option value="">— Selecciona —</option>
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

            {/* ✅ Botón + menú superpuesto (mismo estilo) */}
            <div ref={supervisorBoxRef} className="relative">
              <button
                type="button"
                onClick={() => setIsOpenSupervisor((v) => !v)}
                className="h-9 w-full rounded border border-slate-300 bg-white px-3 pr-9
                 text-left text-xs whitespace-nowrap truncate
                 focus:outline-none focus:ring-1 focus:ring-slate-900/10 focus:border-slate-900
                 transition hover:shadow-sm active:scale-[.99]"
                aria-expanded={isOpenSupervisor}
              >
                {selSupervisorId ? (
                  supervisoresOptionsWithSelected.find(
                    (s) => s.id === selSupervisorId
                  )?.label ||
                  initialData?.supervisor ||
                  initialData?.SUPERVISOR
                ) : (
                  <span className="text-slate-400">— Selecciona —</span>
                )}
              </button>

              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </span>

              <div
                className={[
                  "absolute left-0 top-full z-50 mt-1 w-full border border-slate-200 bg-white shadow-lg",
                  "transform origin-top transition duration-150",
                  isOpenSupervisor
                    ? "opacity-100 scale-100 pointer-events-auto"
                    : "opacity-0 scale-95 pointer-events-none",
                ].join(" ")}
              >
                {/* ⛔️ Evita que el mousedown burbujee hasta el botón */}
                <div
                  className="max-h-56 overflow-y-auto text-xs"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Opción vacía */}
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                      !selSupervisorId ? "bg-slate-100" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelSupervisorId("");
                      setIsOpenSupervisor(false);
                    }}
                  >
                    — Selecciona —
                  </div>

                  {/* Legacy si aplica */}
                  {selSupervisorId &&
                    !supervisoresOptionsWithSelected.some(
                      (s) => s.id === selSupervisorId
                    ) &&
                    (initialData?.supervisor || initialData?.SUPERVISOR) && (
                      <div
                        className="px-3 py-2 cursor-pointer hover:bg-slate-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelSupervisorId(selSupervisorId);
                          setIsOpenSupervisor(false);
                        }}
                        title={initialData.supervisor || initialData.SUPERVISOR}
                      >
                        {initialData.supervisor || initialData.SUPERVISOR}
                      </div>
                    )}

                  {/* Opciones reales */}
                  {supervisoresOptionsWithSelected.map((op) => (
                    <div
                      key={op.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                        selSupervisorId === op.id ? "bg-slate-100" : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelSupervisorId(op.id);
                        setIsOpenSupervisor(false); // ✅ se cierra sin parpadeo
                      }}
                      title={op.label}
                    >
                      {op.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </label>
          {/*consultorRegistrado*/}
          <label className="col-span-12 md:col-span-3 text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Consultor registrado
            </span>

            <CustomSelect
              value={consultorRegistrado}
              onChange={(val) => setConsultorRegistrado(val)}
              options={consultoresRegistrados} // [{ _id, nombre }]
              getOptionValue={(o) => o.nombre} // mantienes el estado como NOMBRE (string)
              getOptionLabel={(o) => o.nombre}
            />
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
            <CustomSelect
              value={selTipoId}
              onChange={(id) => {
                setSelTipoId(id);
                const tipo = tiposVenta.find((t) => t.id === id);
                setForm((p) => ({
                  ...p,
                  TIPO_V: tipo?.label || "",
                  PRODUCTO: "",
                  TIPO_DE_VENTA: "",
                }));
                setSelProdId("");
              }}
              options={tiposVenta} // [{id,label}]
              getOptionValue={(o) => o.id}
              getOptionLabel={(o) => o.label}
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              Producto
            </span>
            <CustomSelect
              value={selProdId}
              onChange={(id) => {
                setSelProdId(id);
                const prod = productos.find((p) => p.id === id);
                setForm((p) => ({
                  ...p,
                  PRODUCTO: prod?.label || "",
                  TIPO_DE_VENTA: "",
                }));
              }}
              options={productosFiltrados} // memo: productos.filter(p => p.tipoVentaId===selTipoId)
              getOptionValue={(o) => o.id}
              getOptionLabel={(o) => o.label}
              disabled={!selTipoId}
            />
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
        <div className="grid grid-cols-12 md:grid-cols-2 gap-3 px-5 pb-5">
          {/* Plan */}
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">Plan</span>
            {isVentasMoviles ? (
              <div ref={planBoxRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsOpenPlan((v) => !v)}
                  className="h-9 w-full rounded border border-slate-300 bg-white px-3 pr-9 text-left text-xs whitespace-nowrap truncate"
                >
                  {plan || (
                    <span className="text-slate-400">— Selecciona —</span>
                  )}
                </button>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ▼
                </span>
                <div
                  className={[
                    "absolute left-0 top-full z-50 mt-1 w-full border border-slate-200 bg-white shadow-lg",
                    "transform origin-top transition duration-150",
                    isOpenPlan
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-95 pointer-events-none",
                  ].join(" ")}
                >
                  <div className="max-h-56 overflow-y-auto text-xs">
                    <div
                      className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                        !plan ? "bg-slate-100" : ""
                      }`}
                      onClick={() => {
                        setPlan("");
                        setIsOpenPlan(false);
                      }}
                    >
                      <span className="block w-full truncate">
                        — Selecciona —
                      </span>
                    </div>
                    {planes.map((p) => (
                      <div
                        key={p._id}
                        className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                          plan === p.name ? "bg-slate-100" : ""
                        }`}
                        onClick={() => {
                          setPlan(p.name);
                          setIsOpenPlan(false);
                        }}
                        title={p.name}
                      >
                        <span className="block w-full truncate">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <input
                className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Escribe el plan"
              />
            )}
          </label>

          {/* Descuento + PDV en dos columnas iguales */}
          <div className="grid grid-cols-12 gap-3">
            <label className="col-span-12 md:col-span-6 text-xs">
              <span className="mb-1 block font-medium text-slate-700">
                Descuento facturación
              </span>
              <select
                className="h-9 w-full rounded border border-slate-300 bg-white px-3 text-xs"
                value={dsctoFacturacion}
                onChange={(e) => setDsctoFacturacion(e.target.value)}
              >
                {descuentosDisponibles.map((pct) => (
                  <option key={pct} value={pct}>
                    {pct} %
                  </option>
                ))}
              </select>
            </label>

            <div className="col-span-12 md:col-span-6 text-xs">
              <span className="mb-1 block font-medium text-slate-700">PDV</span>
              <label className="h-9 w-full rounded border border-slate-300 px-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={pdv}
                  onChange={(e) => setPdv(e.target.checked)}
                />
                <span className="text-slate-700">Activar</span>
              </label>
            </div>
          </div>

          {/* CF (base) – editable y de doble vía */}
          {/* CF con IGV */}
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              CF con IGV
            </span>
            <input
              className={`h-9 w-full rounded border px-3 text-xs ${
                pdv && extractPlanPrice(plan) != null
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-300"
              }`}
              value={cfConIgv}
              onChange={onChangeCfConIgv}
              readOnly={pdv && extractPlanPrice(plan) != null}
              placeholder="0.00"
            />
          </label>

          {/* CF sin IGV */}
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              CF sin IGV
            </span>

            <input
              className={`h-9 w-full rounded border px-3 text-xs ${
                pdv && extractPlanPrice(plan) != null
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-300"
              }`}
              value={cfSinIgv}
              onChange={onChangeCfSinIgv}
              readOnly={pdv && extractPlanPrice(plan) != null}
              placeholder="0.00"
            />
          </label>

          {/* CF facturación con descuento (solo si PDV = ON) */}
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              CF facturación con descuento (con IGV)
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs"
              value={cfDsctoConIgv != null ? cfDsctoConIgv.toFixed(2) : ""}
              readOnly
              placeholder="—"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-700">
              CF facturación con descuento (sin IGV)
            </span>
            <input
              className="h-9 w-full rounded border border-slate-200 bg-slate-50 px-3 text-xs"
              value={cfDsctoSinIgv != null ? cfDsctoSinIgv.toFixed(2) : ""}
              readOnly
              placeholder="—"
            />
          </label>
        </div>
        {/* Contenedor en 3 columnas iguales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-5 pb-5">
          {/* Equipo */}
          <label className="text-xs w-full">
            <span className="mb-1 block font-medium text-slate-700">
              Equipo
            </span>

            <div ref={equipoBoxRef} className="relative">
              <CustomSelect
                value={form.EQUIPO}
                onChange={(val) => setForm((p) => ({ ...p, EQUIPO: val }))}
                options={equipos} // [{_id, name}]
                getOptionValue={(o) => o.name}
                getOptionLabel={(o) => o.name}
              />

              {/* Flechita */}
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </span>

              {/* Menú superpuesto */}
              {isOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full border border-slate-200 bg-white shadow-lg">
                  <div className="max-h-56 overflow-y-auto text-xs">
                    <div
                      className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                        form.EQUIPO === "" ? "bg-slate-100" : ""
                      }`}
                      onClick={() => {
                        setForm((p) => ({ ...p, EQUIPO: "" }));
                        setIsOpen(false);
                      }}
                    >
                      — Selecciona —
                    </div>

                    {equipos.map((eq) => (
                      <div
                        key={eq._id}
                        className={`px-3 py-2 cursor-pointer hover:bg-slate-50 ${
                          form.EQUIPO === eq.name ? "bg-slate-100" : ""
                        }`}
                        onClick={() => {
                          setForm((p) => ({ ...p, EQUIPO: eq.name }));
                          setIsOpen(false);
                        }}
                        title={eq.name}
                      >
                        {eq.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </label>

          {/* Costo Equipo */}
          <label className="text-xs w-full">
            <span className="mb-1 block font-medium text-slate-700">
              Costo Equipo
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={costoEquipo}
              onChange={(e) => setCostoEquipo(e.target.value)}
            />
          </label>

          {/* Líneas */}
          <label className="text-xs w-full">
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
        <div className="grid grid-cols-12 md:grid-cols-3 gap-4 p-5">
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

        {/* Segunda fila → 4 columnas */}
        <div className="grid grid-cols-12 md:grid-cols-2 gap-4 px-5 pb-5">
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
              Distrito
            </span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              value={distrito}
              onChange={(e) => setDistrito(e.target.value)}
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
