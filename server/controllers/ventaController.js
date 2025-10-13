// backend/controllers/ventaController.js
import Venta from "../models/Venta.js";
import * as XLSX from "xlsx";
import { Readable } from "stream";

import mongoose from "mongoose";
import User from "../models/User.js";

/* ─────────────────────────── Helpers comunes ─────────────────────────── */
const asArr = (v) =>
  Array.isArray(v)
    ? v.filter((x) => x !== "" && x != null)
    : v !== undefined && v !== ""
    ? [v]
    : [];

const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pad2 = (n) => String(n).padStart(2, "0");

// Para agregations: arma un $or de rangos de fecha sobre el campo 'fa' (Date)
const buildYearMonthOr = (yearsArr = [], monthsArr = []) => {
  const clauses = [];
  const ys = yearsArr.map((y) => String(y).padStart(4, "0"));
  const ms = monthsArr.map((m) => String(m).padStart(2, "0"));
  if (ys.length === 0) return null;

  if (ms.length === 0) {
    // Años completos
    for (const y of ys) {
      clauses.push({
        fa: {
          $gte: new Date(`${y}-01-01T00:00:00.000Z`),
          $lt: new Date(`${Number(y) + 1}-01-01T00:00:00.000Z`),
        },
      });
    }
  } else {
    // Combinaciones año-mes
    for (const y of ys) {
      for (const m of ms) {
        const nextM =
          m === "12" ? "01" : String(Number(m) + 1).padStart(2, "0");
        const nextY = m === "12" ? String(Number(y) + 1) : y;
        clauses.push({
          fa: {
            $gte: new Date(`${y}-${m}-01T00:00:00.000Z`),
            $lt: new Date(`${nextY}-${nextM}-01T00:00:00.000Z`),
          },
        });
      }
    }
  }
  return clauses.length ? { $or: clauses } : null;
};

// PDV (sí/no) a filtro mongo
const buildPdvMatch = (pdvRaw) => {
  if (pdvRaw == null) return null;
  const v = String(pdvRaw).trim().toLowerCase();
  if (["sí", "si", "true", "1", "yes"].includes(v)) {
    return { PDV: { $regex: /^\s*s[ií]\s*$/i } };
  }
  if (["no", "false", "0"].includes(v)) {
    return {
      $or: [
        { PDV: { $exists: false } },
        { PDV: null },
        { PDV: "" },
        { PDV: { $regex: /^\s*no?\s*$/i } },
      ],
    };
  }
  return null;
};

// Normaliza FECHA_ACTIVACION a Date en el campo 'fa' (para pipelines)
const addFaStage = {
  $addFields: {
    fa: {
      $switch: {
        branches: [
          {
            case: { $eq: [{ $type: "$FECHA_ACTIVACION" }, "date"] },
            then: "$FECHA_ACTIVACION",
          },
          {
            case: {
              $and: [
                { $eq: [{ $type: "$FECHA_ACTIVACION" }, "string"] },
                {
                  $regexMatch: {
                    input: "$FECHA_ACTIVACION",
                    regex: /^\d{4}-\d{2}-\d{2}$/,
                  },
                },
              ],
            },
            then: {
              $toDate: { $concat: ["$FECHA_ACTIVACION", "T00:00:00.000Z"] },
            },
          },
        ],
        default: null,
      },
    },
  },
};

// Id del rol "Comercial" (mismo del frontend)
const COMERCIAL_ROLE_IDS = new Set(["68a4f22d27e6abe98157a831"]);

// Id del estado de usuario "Activo" (el que usas en /users/activos)
const ESTADO_ACTIVO_ID = new mongoose.Types.ObjectId(
  "68a4f3dc27e6abe98157a845"
);

const isComercialDoc = (u) => {
  const r = u?.role;
  if (!r) return false;

  // por id
  const roleId = typeof r === "string" ? r : r?._id ? String(r._id) : null;
  if (roleId && COMERCIAL_ROLE_IDS.has(roleId)) return true;

  // por nombre
  const roleName = (r?.name || r?.nombre || r?.slug || "").toLowerCase();
  return roleName === "comercial";
};

const displayFromUser = (u = {}) =>
  u.name || [u.firstName, u.lastName].filter(Boolean).join(" ").trim();

const normalizeName = (s = "") =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// ── Helper para elegir el campo CF según cfMode ─────────────────────────
const CF_MAP = {
  normal: "CF SIN IGV",
  facturacion: "CF FACTURACION DSCTO SIN IGV",
  // Si luego amplías a CON IGV:
  // normal_con: "CF INC IGV",
  // fact_con: "CF FACTURACION DSCTO CON IGV",
};
const getCfField = (cfMode) => CF_MAP[cfMode] || CF_MAP.normal;

/* ─────────────────────────── CREATE ─────────────────────────── */
// ✅ CREATE — acoplado a los campos del formulario (incluye CF FACTURACION DSCTO ...)
export async function createVenta(req, res) {
  try {
    const b = req.body || {};

    const pick = (...keys) => {
      for (const k of keys) {
        if (b[k] !== undefined && b[k] !== null) return b[k];
      }
      return undefined;
    };
    const toFloat = (v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = parseFloat(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };
    const toInt = (v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };

    const hoy = new Date().toISOString().slice(0, 10);

    const estadoFinal = (pick("estadoFinal", "ESTADO FINAL") || "").trim();
    let fechaActivacion = pick("FECHA_ACTIVACION", "fechaActivacion");
    if (!fechaActivacion) {
      // ⚠️ Mantengo tu comportamiento: si no viene, setea según estado
      fechaActivacion = estadoFinal.toLowerCase() === "aprobado" ? hoy : "";
    }

    const Q = toInt(pick("Q", "q"));
    const cfSinIgv = toFloat(pick("CF SIN IGV", "cfSinIgv", "cf_sin_igv"));
    let cfIncIgv = toFloat(
      pick("CF INC IGV", "CF CON IGV", "cfConIgv", "cf_inc_igv")
    );
    if (cfIncIgv === null && cfSinIgv !== null)
      cfIncIgv = +(cfSinIgv * 1.18).toFixed(2);

    // ✅ NUEVO: CF facturación con descuento (ambos)
    const cfDescSinIgv = toFloat(
      pick(
        "CF FACTURACION DSCTO SIN IGV",
        "cfDescSinIgv",
        "cf_facturacion_dscto_sin_igv",
        "cf_desc_sin_igv"
      )
    );
    const cfDescConIgv = toFloat(
      pick(
        "CF FACTURACION DSCTO CON IGV",
        "cfDescConIgv",
        "cf_facturacion_dscto_con_igv",
        "cf_desc_con_igv"
      )
    );

    const consultorNombre =
      pick("CONSULTORES", "consultor", "consultorNombre") || "";
    const consultorRegistrado =
      pick("CONSULTOR REGISTRADO", "consultorRegistrado") || "";

    const dniConsultor = pick("DNI_CONSULTOR", "dniConsultor") ?? null;

    const distrito = pick("DISTRITO", "distrito") || "";
    const plan = pick("PLAN", "plan") || "";
    const costoEquipo = toFloat(
      pick("COSTO_EQUIPO", "COSTO EQUIPO", "costoEquipo")
    );

    const pdvBody = pick("PDV", "pdv");
    const pdv =
      pdvBody === true ||
      pdvBody === 1 ||
      String(pdvBody).trim().toLowerCase() === "sí" ||
      String(pdvBody).trim().toLowerCase() === "si" ||
      String(pdvBody).trim().toLowerCase() === "true"
        ? "Sí"
        : "";

    const motivoRechazo =
      estadoFinal.toLowerCase() === "rechazado"
        ? pick("MOTIVO RECHAZO", "motivoRechazo") || ""
        : "";

    const dsctoFact =
      pick(
        "DSCTO FACTURACION",
        "DSCTO FACT",
        "DESCUENTO FACTURACION",
        "descuentoFacturacion",
        "dsctoFacturacion"
      ) || "";

    let segmento = pick("SEGMENTO", "segmento") || "";
    const segmentoId = pick("segmentoId", "SEGMENTO_ID");
    if (!segmento && segmentoId) {
      try {
        const { default: SegmentoEmpresa } = await import(
          "../models/SegmentoEmpresa.js"
        );
        const seg = await SegmentoEmpresa.findById(segmentoId).lean();
        if (seg?.name) segmento = seg.name;
      } catch {}
    }

    const venta = new Venta({
      FECHA_INGRESO: pick("fechaIngreso", "FECHA_INGRESO") || hoy,
      FECHA_ACTIVACION: fechaActivacion || hoy,
      SEC_PROYECTO_SOT: pick("SEC_PROYECTO_SOT", "secProyectoSot") || "",

      TIPO_V: pick("tipoV", "TIPO_V") || "",
      PRODUCTO: pick("producto", "PRODUCTO") || "",

      "RAZON SOCIAL CLIENTE": pick("razonSocial", "RAZON SOCIAL CLIENTE") || "",
      "ESTADO FINAL": estadoFinal || "",
      RUC: pick("ruc", "RUC") || "",

      LINEAS: pick("lineas", "LINEAS") || "",
      CUENTA: pick("cuenta", "CUENTA") || "",
      EQUIPO: pick("equipo", "EQUIPO") || "",
      SALESFORCE: pick("salesforce", "SALESFORCE") || "",
      Loteo: pick("loteo", "Loteo") || "",

      CONSULTORES: consultorNombre,
      "CONSULTOR REGISTRADO": consultorRegistrado,
      DNI_CONSULTOR: dniConsultor,
      SUPERVISOR: pick("supervisor", "SUPERVISOR") || "",

      Q,
      "CF SIN IGV": cfSinIgv,
      "CF INC IGV": cfIncIgv,

      // ✅ NUEVO: se guardan tal cual llegan (numéricos)
      "CF FACTURACION DSCTO SIN IGV": cfDescSinIgv,
      "CF FACTURACION DSCTO CON IGV": cfDescConIgv,

      DISTRITO: distrito,
      PLAN: plan,
      "COSTO EQUIPO": costoEquipo,
      PDV: pdv,
      "MOTIVO RECHAZO": motivoRechazo,
      SEGMENTO: segmento,
      "DSCTO FACTURACION": dsctoFact,

      NOMBRE: pick("NOMBRE") || "",
      CORREO: pick("CORREO") || "",
      NUMERO: pick("NUMERO") || "",
      NOMBRE2: pick("NOMBRE2") || "",
      CORREO4: pick("CORREO4") || "",
      NUMERO3: pick("NUMERO3") || "",
    });

    await venta.save();
    return res.status(201).json(venta);
  } catch (err) {
    console.error("Error creando venta:", err);
    return res.status(500).json({ message: "Error al crear venta" });
  }
}

/* ─────────────────────────── LIST (find) ─────────────────────────── */
export async function listVentas(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const { estado, year, month, producto, tipoVenta, pdv } = req.query;
    const query = {};

    /* ---------- Filtros ---------- */
    const estados = asArr(estado);
    if (estados.length) query["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) query.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      query["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(query, pdvMatch);

    // Año/Mes con regex (mientras sigas guardando fechas como string)
    const ys = asArr(year).map((y) => String(y).padStart(4, "0"));
    const ms = asArr(month).map((m) => String(m).padStart(2, "0"));

    if (ys.length) {
      if (ms.length === 0) {
        query.FECHA_ACTIVACION = {
          $regex: new RegExp(`^(${ys.map(escRe).join("|")})`),
        };
      } else if (ys.length === 1) {
        query.FECHA_ACTIVACION = {
          $regex: new RegExp(`^${escRe(ys[0])}-(?:${ms.map(escRe).join("|")})`),
        };
      } else {
        query.$or = ys.map((y) => ({
          FECHA_ACTIVACION: {
            $regex: ms.length
              ? new RegExp(`^${escRe(y)}-(?:${ms.map(escRe).join("|")})`)
              : new RegExp(`^${escRe(y)}`),
          },
        }));
      }
    } else if (ms.length) {
      query.FECHA_ACTIVACION = {
        $regex: new RegExp(`^\\d{4}-(?:${ms.map(escRe).join("|")})`),
      };
    }

    // 🔎 Búsqueda global (se mantiene)
    if (req.query.search) {
      const search = req.query.search.trim();
      const regex = new RegExp(escRe(search), "i");
      const maybeNumber = Number(search);
      const isNumeric = !isNaN(maybeNumber);

      query.$or = [
        { "RAZON SOCIAL CLIENTE": regex },
        { PRODUCTO: regex },
        { "ESTADO FINAL": regex },
        { CONSULTORES: regex },
        { SUPERVISOR: regex },
        { "CONSULTOR REGISTRADO": regex },
        { PDV: regex },
        { SEGMENTO: regex },
        { NOMBRE: regex },
        { NUMERO: regex },
        { CORREO: regex },
        { NOMBRE2: regex },
        { NUMERO3: regex },
        { CORREO4: regex },

        { RUC: regex },
        { LINEAS: regex },
        { Q: regex },

        ...(isNumeric
          ? [{ RUC: maybeNumber }, { LINEAS: maybeNumber }, { Q: maybeNumber }]
          : []),
      ];
    }

    /* ---------- Total ---------- */
    const total = await Venta.countDocuments(query);

    /* ---------- Pipeline ---------- */
    const pipeline = [
      { $match: query },
      addFaStage, // convierte FECHA_ACTIVACION en Date (campo "fa")
      { $sort: { fa: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { __v: 0 } },
    ];

    const data = await Venta.aggregate(pipeline).allowDiskUse(true);

    /* ---------- Normalización ---------- */
    const normalized = data.map((v) => ({
      // básicos
      _id: v._id,
      fechaIngreso: v["FECHA_INGRESO"],
      fechaActivacion: v["FECHA_ACTIVACION"],
      ruc: v["RUC"],
      razonSocial: v["RAZON SOCIAL CLIENTE"],
      estadoFinal: v["ESTADO FINAL"],
      secProyectoSot: v["SEC_PROYECTO_SOT"],

      // catálogos
      tipoV: v["TIPO_V"],
      producto: v["PRODUCTO"],

      // adicionales
      lineas: v["LINEAS"],
      cuenta: v["CUENTA"],
      equipo: v["EQUIPO"],
      salesforce: v["SALESFORCE"],
      loteo: v["Loteo"],

      // personas
      consultores: v["CONSULTORES"],
      dniConsultor: v["DNI_CONSULTOR"],
      supervisor: v["SUPERVISOR"],
      consultorRegistrado: v["CONSULTOR REGISTRADO"],

      // numéricos
      q: v["Q"],
      cfSinIgv: v["CF SIN IGV"],
      cfConIgv: v["CF INC IGV"],
      // ✅ NUEVOS en la respuesta:
      cfDescSinIgv: v["CF FACTURACION DSCTO SIN IGV"],
      cfDescConIgv: v["CF FACTURACION DSCTO CON IGV"],
      // detalle
      distrito: v["DISTRITO"],
      plan: v["PLAN"],
      costoEquipo: v["COSTO EQUIPO"],
      pdv: v["PDV"],
      motivoRechazo: v["MOTIVO RECHAZO"],
      segmento: v["SEGMENTO"],
      dsctoFacturacion: v["DSCTO FACTURACION"],

      // contactos
      nombre: v["NOMBRE"],
      numero: v["NUMERO"],
      correo: v["CORREO"],
      nombre2: v["NOMBRE2"],
      numero3: v["NUMERO3"],
      correo4: v["CORREO4"],
    }));

    return res.json({ page, limit, total, data: normalized });
  } catch (err) {
    console.error("❌ Error al obtener ventas:", err);
    return res.status(500).json({ error: "Error al obtener ventas" });
  }
}

/* ─────────────────────────── LÍNEAS ─────────────────────────── */
export async function getGraficoLineas(req, res) {
  try {
    const { estado, year, month, producto, tipoVenta, pdv, cfMode } = req.query;

    // -------- Filtros base (campos literales, NO fecha) --------
    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    // -------- Parámetros de tiempo --------
    const yearsArr = asArr(year)
      .map((y) => parseInt(y, 10))
      .filter(Number.isFinite);
    const monthsArr = asArr(month)
      .map((m) => parseInt(m, 10))
      .filter(Number.isFinite);
    const monthsPadded = monthsArr.map((m) => String(m).padStart(2, "0"));

    // Campo CF según modo
    const CF_FIELD =
      (cfMode || "normal") === "facturacion"
        ? "CF FACTURACION DSCTO SIN IGV"
        : "CF SIN IGV";

    // -------- Pipeline --------
    const pipeline = [
      addFaStage, // fa (fecha) primero para poder filtrar por rango
      { $match: match }, // filtros “no-fecha” (aprovechan índices de esos campos)
    ];

    // Filtrado por tiempo (evitar $expr siempre que sea posible)
    if (yearsArr.length && !monthsArr.length) {
      // Solo años → rangos por año (sargable)
      const orYears = yearsArr.map((y) => ({
        fa: {
          $gte: new Date(`${String(y).padStart(4, "0")}-01-01T00:00:00.000Z`),
          $lt: new Date(
            `${String(y + 1).padStart(4, "0")}-01-01T00:00:00.000Z`
          ),
        },
      }));
      pipeline.push({ $match: { $or: orYears } });
    } else if (yearsArr.length && monthsArr.length) {
      // Años + meses → rangos por (año, mes) (sargable)
      const orYM = [];
      for (const y of yearsArr) {
        for (const m of monthsArr) {
          const mm = String(m).padStart(2, "0");
          orYM.push({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-${mm}-01T00:00:00.000Z`
              ),
              $lt: new Date(y, m, 1), // primer día del mes siguiente en local → ok para límite estricto
            },
          });
        }
      }
      pipeline.push({ $match: { $or: orYM } });
    } else if (!yearsArr.length && monthsArr.length) {
      // Solo meses, cualquier año → no sargable; calculamos mm y filtramos
      pipeline.push({
        $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
      });
      pipeline.push({ $match: { mm: { $in: monthsPadded } } });
    } // si no hay filtros de tiempo, no añadimos nada (todos los meses/todos los años)

    pipeline.push(
      // Proyección mínima + conversión segura a número
      {
        $project: {
          mes: { $dateToString: { format: "%m", date: "$fa" } },
          CF: {
            $convert: {
              input: { $ifNull: [`$${CF_FIELD}`, 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          Q: {
            $convert: {
              input: { $ifNull: ["$Q", 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      {
        $match: {
          mes: {
            $in: [
              "01",
              "02",
              "03",
              "04",
              "05",
              "06",
              "07",
              "08",
              "09",
              "10",
              "11",
              "12",
            ],
          },
        },
      },
      {
        $group: {
          _id: "$mes",
          totalCF: { $sum: "$CF" },
          totalQ: { $sum: "$Q" },
        },
      },
      { $sort: { _id: 1 } }
    );

    const raw = await Venta.aggregate(pipeline).allowDiskUse(true);

    // Relleno de 01..12
    const MESES = [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ];
    const map = Object.fromEntries(raw.map((r) => [r._id, r]));
    const data = MESES.map((mm) => ({
      mes: mm,
      CF: Number(map[mm]?.totalCF || 0),
      Q: Number(map[mm]?.totalQ || 0),
    }));

    res.json({ data });
  } catch (err) {
    console.error("❌ Error en getGraficoLineas:", err);
    res.status(500).json({ error: "Error al obtener gráfico de líneas" });
  }
}

/* ─────────────────────────── Torta por Estado ─────────────────────────── */
export async function getDistribucionPorEstado(req, res) {
  try {
    const { estado, year, month, producto, tipoVenta, pdv, cfMode } = req.query;

    const CF_FIELD = getCfField(cfMode);

    // -------- filtros no-fecha ----------
    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    // -------- tiempo (sargable) ----------
    const yearsArr = asArr(year)
      .map((y) => parseInt(y, 10))
      .filter(Number.isFinite);
    const monthsArr = asArr(month)
      .map((m) => parseInt(m, 10))
      .filter(Number.isFinite);
    const monthsPadded = monthsArr.map((m) => String(m).padStart(2, "0"));

    const pipeline = [addFaStage, { $match: match }];

    if (yearsArr.length && !monthsArr.length) {
      pipeline.push({
        $match: {
          $or: yearsArr.map((y) => ({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-01-01T00:00:00.000Z`
              ),
              $lt: new Date(
                `${String(y + 1).padStart(4, "0")}-01-01T00:00:00.000Z`
              ),
            },
          })),
        },
      });
    } else if (yearsArr.length && monthsArr.length) {
      const orYM = [];
      for (const y of yearsArr) {
        for (const m of monthsArr) {
          const mm = String(m).padStart(2, "0");
          orYM.push({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-${mm}-01T00:00:00.000Z`
              ),
              $lt: new Date(y, m, 1),
            },
          });
        }
      }
      pipeline.push({ $match: { $or: orYM } });
    } else if (!yearsArr.length && monthsArr.length) {
      pipeline.push(
        {
          $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
        },
        { $match: { mm: { $in: monthsPadded } } }
      );
    }

    // Normalizar clave y sumar con conversión numérica
    pipeline.push(
      {
        $addFields: {
          estadoStr: {
            $let: {
              vars: {
                raw: { $ifNull: ["$ESTADO FINAL", ""] },
                t: { $type: { $ifNull: ["$ESTADO FINAL", ""] } },
              },
              in: {
                $trim: {
                  input: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$$t", "string"] }, then: "$$raw" },
                        {
                          case: {
                            $in: [
                              "$$t",
                              ["int", "long", "double", "decimal", "bool"],
                            ],
                          },
                          then: { $toString: "$$raw" },
                        },
                      ],
                      default: "",
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          estadoStr: 1,
          CF: {
            $convert: {
              input: { $ifNull: [`$${CF_FIELD}`, 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          Q: {
            $convert: {
              input: { $ifNull: ["$Q", 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: "$estadoStr",
          totalCF: { $sum: "$CF" },
          totalQ: { $sum: "$Q" },
        },
      },
      { $match: { _id: { $ne: "" } } },
      { $sort: { totalCF: -1 } }
    );

    const data = await Venta.aggregate(pipeline).allowDiskUse(true);
    res.json({ data });
  } catch (err) {
    console.error("❌ Error en getDistribucionPorEstado:", err);
    res.status(500).json({ error: "Error al obtener distribución por estado" });
  }
}

/* ─────────────────────── Distribución por Tipo_V / Drilldown ─────────────────────── */
export async function getDistribucionTipoVenta(req, res) {
  try {
    const {
      estado,
      year,
      month,
      producto,
      tipoVenta,
      pdv,
      detallePor,
      tipo,
      cfMode,
    } = req.query;

    const CF_FIELD = getCfField(cfMode);

    // filtros base
    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tiposFiltro = asArr(tipoVenta);
    if (tiposFiltro.length) {
      match["TIPO_V"] = {
        $in: tiposFiltro.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    // ⬇️ Drill: si viene detallePor=tipoVenta y tipo= <valor de TIPO_V>
    const isDrill = detallePor === "tipoVenta" && !!tipo;
    if (isDrill) match["TIPO_V"] = new RegExp(`^\\s*${escRe(tipo)}\\s*$`, "i");

    // tiempo
    const yearsArr = asArr(year)
      .map((y) => parseInt(y, 10))
      .filter(Number.isFinite);
    const monthsArr = asArr(month)
      .map((m) => parseInt(m, 10))
      .filter(Number.isFinite);
    const monthsPadded = monthsArr.map((m) => String(m).padStart(2, "0"));

    const pipeline = [addFaStage, { $match: match }];

    if (yearsArr.length && !monthsArr.length) {
      pipeline.push({
        $match: {
          $or: yearsArr.map((y) => ({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-01-01T00:00:00.000Z`
              ),
              $lt: new Date(
                `${String(y + 1).padStart(4, "0")}-01-01T00:00:00.000Z`
              ),
            },
          })),
        },
      });
    } else if (yearsArr.length && monthsArr.length) {
      const orYM = [];
      for (const y of yearsArr) {
        for (const m of monthsArr) {
          const mm = String(m).padStart(2, "0");
          orYM.push({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-${mm}-01T00:00:00.000Z`
              ),
              $lt: new Date(y, m, 1),
            },
          });
        }
      }
      pipeline.push({ $match: { $or: orYM } });
    } else if (!yearsArr.length && monthsArr.length) {
      pipeline.push(
        {
          $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
        },
        { $match: { mm: { $in: monthsPadded } } }
      );
    }

    // normalizar claves para TIPO_V y PRODUCTO (por si vienen números o bool)
    pipeline.push(
      {
        $addFields: {
          tipoVStr: {
            $let: {
              vars: {
                raw: { $ifNull: ["$TIPO_V", ""] },
                t: { $type: { $ifNull: ["$TIPO_V", ""] } },
              },
              in: {
                $trim: {
                  input: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$$t", "string"] }, then: "$$raw" },
                        {
                          case: {
                            $in: [
                              "$$t",
                              ["int", "long", "double", "decimal", "bool"],
                            ],
                          },
                          then: { $toString: "$$raw" },
                        },
                      ],
                      default: "",
                    },
                  },
                },
              },
            },
          },
          productoStr: {
            $let: {
              vars: {
                raw: { $ifNull: ["$PRODUCTO", ""] },
                t: { $type: { $ifNull: ["$PRODUCTO", ""] } },
              },
              in: {
                $trim: {
                  input: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$$t", "string"] }, then: "$$raw" },
                        {
                          case: {
                            $in: [
                              "$$t",
                              ["int", "long", "double", "decimal", "bool"],
                            ],
                          },
                          then: { $toString: "$$raw" },
                        },
                      ],
                      default: "",
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          groupKey: isDrill ? "$productoStr" : "$tipoVStr", // 👈 AQUI el cambio: agrupa por PRODUCTO si hay drill
          CF: {
            $convert: {
              input: { $ifNull: [`$${CF_FIELD}`, 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          Q: {
            $convert: {
              input: { $ifNull: ["$Q", 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: "$groupKey",
          totalReg: { $sum: 1 },
          totalQ: { $sum: "$Q" },
          totalCF: { $sum: "$CF" },
        },
      },
      { $match: { _id: { $ne: "" } } },
      { $sort: { totalReg: -1 } }
    );

    const raw = await Venta.aggregate(pipeline).allowDiskUse(true);
    const data = raw.map((r) => ({
      name: r._id,
      totalReg: Number(r.totalReg || 0),
      totalQ: Number(r.totalQ || 0),
      totalCF: Number(r.totalCF || 0),
    }));

    res.json({ data, meta: { drill: isDrill, tipo: tipo || null } });
  } catch (err) {
    console.error("❌ Error en getDistribucionTipoVenta:", err);
    res
      .status(500)
      .json({ error: "Error al obtener distribución por tipo de venta" });
  }
}

/* ─────────────────────────── Dona PDV ─────────────────────────── */
export async function getDistribucionPDV(req, res) {
  try {
    const { estado, year, month, producto, tipoVenta, pdvOnly, cfMode } =
      req.query;

    const CF_FIELD = getCfField(cfMode);

    // -------- filtros no-fecha ----------
    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    // -------- tiempo (sargable) ----------
    const yearsArr = asArr(year)
      .map((y) => parseInt(y, 10))
      .filter(Number.isFinite);
    const monthsArr = asArr(month)
      .map((m) => parseInt(m, 10))
      .filter(Number.isFinite);
    const monthsPadded = monthsArr.map((m) => String(m).padStart(2, "0"));

    const pipeline = [addFaStage, { $match: match }];

    if (yearsArr.length && !monthsArr.length) {
      pipeline.push({
        $match: {
          $or: yearsArr.map((y) => ({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-01-01T00:00:00.000Z`
              ),
              $lt: new Date(
                `${String(y + 1).padStart(4, "0")}-01-01T00:00:00.000Z`
              ),
            },
          })),
        },
      });
    } else if (yearsArr.length && monthsArr.length) {
      const orYM = [];
      for (const y of yearsArr) {
        for (const m of monthsArr) {
          const mm = String(m).padStart(2, "0");
          orYM.push({
            fa: {
              $gte: new Date(
                `${String(y).padStart(4, "0")}-${mm}-01T00:00:00.000Z`
              ),
              $lt: new Date(y, m, 1),
            },
          });
        }
      }
      pipeline.push({ $match: { $or: orYM } });
    } else if (!yearsArr.length && monthsArr.length) {
      pipeline.push(
        {
          $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
        },
        { $match: { mm: { $in: monthsPadded } } }
      );
    }

    // -------- bucket PDV / No PDV (string-seguro) ----------
    pipeline.push(
      {
        $addFields: {
          pdvStr: {
            $let: {
              vars: {
                raw: { $ifNull: ["$PDV", ""] },
                t: { $type: { $ifNull: ["$PDV", ""] } },
              },
              in: {
                $trim: {
                  input: {
                    $switch: {
                      branches: [
                        { case: { $eq: ["$$t", "string"] }, then: "$$raw" },
                        {
                          case: {
                            $in: [
                              "$$t",
                              ["int", "long", "double", "decimal", "bool"],
                            ],
                          },
                          then: { $toString: "$$raw" },
                        },
                      ],
                      default: "",
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          isPDV: { $regexMatch: { input: "$pdvStr", regex: /^\s*s[ií]\s*$/i } },
        },
      },
      ...(pdvOnly === "true" ? [{ $match: { isPDV: true } }] : []),
      {
        $project: {
          isPDV: 1,
          CF: {
            $convert: {
              input: { $ifNull: [`$${CF_FIELD}`, 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
          Q: {
            $convert: {
              input: { $ifNull: ["$Q", 0] },
              to: "double",
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: "$isPDV",
          totalCF: { $sum: "$CF" },
          totalQ: { $sum: "$Q" },
          total: { $sum: 1 },
        },
      }
    );

    const agg = await Venta.aggregate(pipeline).allowDiskUse(true);

    const data = [
      { _id: "PDV", totalCF: 0, totalQ: 0, total: 0 },
      { _id: "No PDV", totalCF: 0, totalQ: 0, total: 0 },
    ];
    for (const r of agg) {
      const idx = r._id === true ? 0 : 1;
      data[idx].totalCF = Number(r.totalCF || 0);
      data[idx].totalQ = Number(r.totalQ || 0);
      data[idx].total = Number(r.total || 0);
    }

    res.json({ data });
  } catch (err) {
    console.error("❌ Error al obtener distribución por PDV:", err);
    res.status(500).json({ error: "Error al obtener distribución por PDV" });
  }
}

/* ─────────────────────────── Años/Meses para filtros ─────────────────────────── */
export async function getYearsActivacion(_req, res) {
  try {
    const years = await Venta.aggregate([
      {
        $match: { FECHA_ACTIVACION: { $regex: /^\d{4}/ } },
      },
      {
        $project: {
          year: { $toInt: { $substr: ["$FECHA_ACTIVACION", 0, 4] } },
        },
      },
      {
        $group: { _id: "$year" },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    res.json(years.map((x) => x._id));
  } catch (err) {
    console.error("❌ Error en getYearsActivacion:", err);
    res.status(500).json({ error: "Error al obtener años" });
  }
}

export async function getMonthsActivacion(req, res) {
  try {
    const { year } = req.query; // opcional
    const match = {};

    const pipeline = [
      addFaStage,
      ...(year
        ? [
            {
              $match: {
                fa: {
                  $gte: new Date(
                    `${String(year).padStart(4, "0")}-01-01T00:00:00.000Z`
                  ),
                  $lt: new Date(
                    `${
                      Number(String(year).padStart(4, "0")) + 1
                    }-01-01T00:00:00.000Z`
                  ),
                },
              },
            },
          ]
        : []),
      { $project: { m: { $dateToString: { format: "%m", date: "$fa" } } } },
      { $group: { _id: "$m" } },
      { $project: { _id: 0, m: { $toInt: "$_id" } } },
      { $sort: { m: 1 } },
    ];

    const months = await Venta.aggregate(pipeline);
    res.json(months.map((x) => x.m)); // [1,2,3,...]
  } catch (err) {
    console.error("❌ Error en getMonthsActivacion:", err);
    res.status(500).json({ error: "Error al obtener meses" });
  }
}

/* ─────────────────────────── CRUD: Editar / Eliminar / Duplicar ─────────────────────────── */
export async function updateVenta(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "ID requerido" });

    const b = req.body || {};
    const hoy = new Date().toISOString().slice(0, 10);

    const pick = (...keys) => {
      for (const k of keys) {
        if (b[k] !== undefined && b[k] !== null) return b[k];
      }
      return undefined;
    };
    const toFloat = (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = parseFloat(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    };
    const toInt = (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : undefined;
    };

    // $set solo con lo que realmente llega
    const $set = {};

    // Básicos (NO tocamos FECHA_INGRESO aquí)
    if (pick("razonSocial", "RAZON SOCIAL CLIENTE") !== undefined)
      $set["RAZON SOCIAL CLIENTE"] = pick(
        "razonSocial",
        "RAZON SOCIAL CLIENTE"
      );

    if (pick("ruc", "RUC") !== undefined) $set["RUC"] = pick("ruc", "RUC");

    if (pick("secProyectoSot", "SEC_PROYECTO_SOT") !== undefined)
      $set["SEC PROYECTO SOT"] = pick("secProyectoSot", "SEC_PROYECTO_SOT");

    // Catálogos
    if (pick("tipoV", "TIPO_V") !== undefined)
      $set["TIPO_V"] = pick("tipoV", "TIPO_V");

    if (pick("producto", "PRODUCTO") !== undefined)
      $set["PRODUCTO"] = pick("producto", "PRODUCTO");

    if (pick("tipoDeVenta", "TIPO_DE_VENTA", "TIPO DE VENTA") !== undefined)
      $set["TIPO DE VENTA"] = pick(
        "tipoDeVenta",
        "TIPO_DE_VENTA",
        "TIPO DE VENTA"
      );

    // Estado + fecha activación
    if (pick("estadoFinal", "ESTADO FINAL") !== undefined)
      $set["ESTADO FINAL"] = pick("estadoFinal", "ESTADO FINAL");

    const faIn = pick("fechaActivacion", "FECHA_ACTIVACION");
    if (faIn !== undefined) {
      $set["FECHA_ACTIVACION"] = faIn || ""; // permitir vaciar
    } else if (
      $set["ESTADO FINAL"] &&
      String($set["ESTADO FINAL"]).toLowerCase() === "aprobado"
    ) {
      // si no vino fecha pero se marca como aprobado, ponemos hoy
      $set["FECHA_ACTIVACION"] = hoy;
    }

    // Texto varios
    if (pick("LINEAS") !== undefined) $set["LINEAS"] = pick("LINEAS");
    if (pick("CUENTA") !== undefined) $set["CUENTA"] = pick("CUENTA");
    if (pick("EQUIPO") !== undefined) $set["EQUIPO"] = pick("EQUIPO");
    if (pick("SALESFORCE") !== undefined)
      $set["SALESFORCE"] = pick("SALESFORCE");
    if (pick("Loteo", "loteo") !== undefined)
      $set["Loteo"] = pick("Loteo", "loteo");

    // Personas
    if (
      pick("CONSULTORES", "consultores", "consultor", "consultorNombre") !==
      undefined
    )
      $set["CONSULTORES"] = pick(
        "CONSULTORES",
        "consultores",
        "consultor",
        "consultorNombre"
      );

    if (pick("DNI_CONSULTOR", "dniConsultor") !== undefined)
      $set["DNI_CONSULTOR"] = pick("DNI_CONSULTOR", "dniConsultor");

    if (pick("SUPERVISOR", "supervisor") !== undefined)
      $set["SUPERVISOR"] = pick("SUPERVISOR", "supervisor");

    if (pick("consultorRegistrado", "CONSULTOR REGISTRADO") !== undefined)
      $set["CONSULTOR REGISTRADO"] = pick(
        "consultorRegistrado",
        "CONSULTOR REGISTRADO"
      );

    // Números base
    const q = toInt(pick("q", "Q"));
    if (q !== undefined) $set["Q"] = q;

    const cfSin = toFloat(pick("cfSinIgv", "CF SIN IGV", "cf_sin_igv"));
    if (cfSin !== undefined) $set["CF SIN IGV"] = cfSin;

    let cfCon = toFloat(
      pick("cfConIgv", "CF INC IGV", "CF CON IGV", "cf_inc_igv")
    );
    if (cfCon === undefined && cfSin !== undefined)
      cfCon = +(cfSin * 1.18).toFixed(2);
    if (cfCon !== undefined) $set["CF INC IGV"] = cfCon;

    // ✅ NUEVOS: CF facturación con descuento (numéricos, opcionales)
    const cfDescSin = toFloat(
      pick(
        "cfDescSinIgv",
        "CF FACTURACION DSCTO SIN IGV",
        "cf_facturacion_dscto_sin_igv",
        "cf_desc_sin_igv"
      )
    );
    if (cfDescSin !== undefined)
      $set["CF FACTURACION DSCTO SIN IGV"] = cfDescSin;

    const cfDescCon = toFloat(
      pick(
        "cfDescConIgv",
        "CF FACTURACION DSCTO CON IGV",
        "cf_facturacion_dscto_con_igv",
        "cf_desc_con_igv"
      )
    );
    if (cfDescCon !== undefined)
      $set["CF FACTURACION DSCTO CON IGV"] = cfDescCon;

    // Detalle
    if (pick("distrito", "DISTRITO") !== undefined)
      $set["DISTRITO"] = pick("distrito", "DISTRITO");

    if (pick("plan", "PLAN") !== undefined) $set["PLAN"] = pick("plan", "PLAN");

    const costo = toFloat(pick("costoEquipo", "COSTO EQUIPO", "COSTO_EQUIPO"));
    if (costo !== undefined) $set["COSTO EQUIPO"] = costo;

    // PDV normalizado: "Sí" o "" (igual que en create)
    if (pick("pdv", "PDV") !== undefined) {
      const pdvRaw = pick("pdv", "PDV");
      const v = String(pdvRaw).trim().toLowerCase();
      $set["PDV"] =
        pdvRaw === true ||
        pdvRaw === 1 ||
        ["sí", "si", "true", "1", "yes"].includes(v)
          ? "Sí"
          : "";
    }

    // Motivo rechazo (solo si estado es Rechazado)
    if (pick("motivoRechazo", "MOTIVO RECHAZO") !== undefined) {
      const estado =
        $set["ESTADO FINAL"] ?? pick("estadoFinal", "ESTADO FINAL");
      if (estado && String(estado).toLowerCase() === "rechazado") {
        $set["MOTIVO RECHAZO"] = pick("motivoRechazo", "MOTIVO RECHAZO");
      } else {
        $set["MOTIVO RECHAZO"] = "";
      }
    }

    if (pick("dsctoFacturacion", "DSCTO FACTURACION") !== undefined)
      $set["DSCTO FACTURACION"] = pick("dsctoFacturacion", "DSCTO FACTURACION");

    // Segmento por nombre (si viene)
    if (pick("segmento", "SEGMENTO") !== undefined)
      $set["SEGMENTO"] = pick("segmento", "SEGMENTO");

    // ✅ Segmento por ID (si NO vino nombre, pero sí ID)
    if ($set["SEGMENTO"] === undefined) {
      const segmentoId = pick("segmentoId", "SEGMENTO_ID");
      if (segmentoId !== undefined && segmentoId) {
        try {
          const { default: SegmentoEmpresa } = await import(
            "../models/SegmentoEmpresa.js"
          );
          const seg = await SegmentoEmpresa.findById(segmentoId).lean();
          if (seg?.name) $set["SEGMENTO"] = seg.name;
        } catch {}
      }
    }

    // Contactos
    ["NOMBRE", "CORREO", "NUMERO", "NOMBRE2", "CORREO4", "NUMERO3"].forEach(
      (k) => {
        if (pick(k, k.toLowerCase()) !== undefined)
          $set[k] = pick(k, k.toLowerCase());
      }
    );

    // Nada que actualizar
    if (!Object.keys($set).length)
      return res.json({ updated: 0, message: "Sin cambios" });

    const updated = await Venta.findByIdAndUpdate(
      id,
      { $set },
      { new: true, runValidators: true, lean: true }
    );

    if (!updated) return res.status(404).json({ error: "Venta no encontrada" });
    return res.json(updated);
  } catch (err) {
    console.error("❌ Error en updateVenta:", err);
    return res.status(500).json({ error: "Error al actualizar venta" });
  }
}

export async function deleteVenta(req, res) {
  try {
    // Soporta: DELETE /ventas/:id  o  DELETE /ventas?ids=a&ids=b
    const { id } = req.params;
    const ids = id ? [id] : asArr(req.query.ids);

    if (!ids.length)
      return res.status(400).json({ error: "ID(s) requerido(s)" });

    const r = await Venta.deleteMany({ _id: { $in: ids } });
    return res.json({ deleted: r.deletedCount || 0 });
  } catch (err) {
    console.error("❌ Error en deleteVenta:", err);
    return res.status(500).json({ error: "Error al eliminar venta(s)" });
  }
}

export async function duplicateVentas(req, res) {
  try {
    // Body esperado:
    // { ids: string[]; times?: number; timesPerId?: Record<id, number>; overrides?: object }
    const ids = asArr(req.body?.ids).map(String).filter(Boolean);
    if (!ids.length) {
      return res.status(400).json({ error: "IDs requeridos" });
    }

    const MAX_TIMES = 50; // límite sano por ID
    const MAX_TOTAL = 1000; // límite total por llamada (anti-accidente)

    // Soporta (a) un times global o (b) un mapa timesPerId
    const timesGlobal = Number.isFinite(+req.body?.times)
      ? Math.max(1, Math.min(+req.body.times, MAX_TIMES))
      : 1;
    const timesPerId =
      req.body?.timesPerId && typeof req.body.timesPerId === "object"
        ? req.body.timesPerId
        : null;

    // Calcula cuántas copias por ID (con clamp)
    const perIdTimes = new Map(
      ids.map((id) => {
        const nRaw = timesPerId ? +timesPerId[id] : timesGlobal;
        const n = Number.isFinite(nRaw)
          ? Math.max(1, Math.min(nRaw, MAX_TIMES))
          : 1;
        return [id, n];
      })
    );

    // Chequeo de total
    const totalTarget = Array.from(perIdTimes.values()).reduce(
      (a, b) => a + b,
      0
    );
    if (totalTarget > MAX_TOTAL) {
      return res.status(400).json({
        error: `Demasiadas copias a crear (${totalTarget}). Máximo permitido: ${MAX_TOTAL}.`,
      });
    }

    // Trae originales
    const originals = await Venta.find({ _id: { $in: ids } }).lean();

    if (!originals.length) {
      return res
        .status(200)
        .json({ duplicated: 0, items: [], missingIds: ids, perId: {} });
    }

    const mapOriginal = new Map(originals.map((o) => [String(o._id), o]));
    const missingIds = ids.filter((id) => !mapOriginal.has(id));

    // Fecha ingreso para las copias (hoy) — puedes exponer un override si quieres
    const hoy = new Date().toISOString().slice(0, 10);

    // Overrides (opcional): si mandas un objeto, lo mergeamos superficialmente.
    // ⚠️ Si quieres “whitelist” de campos permitidos, agrega una lista y filtra aquí.
    const overrides =
      req.body?.overrides && typeof req.body.overrides === "object"
        ? req.body.overrides
        : null;

    const docs = [];
    const perIdInserted = Object.fromEntries(ids.map((id) => [id, 0]));

    for (const id of ids) {
      const base = mapOriginal.get(id);
      if (!base) continue;

      // Quitamos campos no copiables
      const { _id, __v, createdAt, updatedAt, ...rest } = base;

      const times = perIdTimes.get(id) ?? 1;
      for (let i = 0; i < times; i++) {
        const clone = {
          ...rest,
          // Ajustes:
          FECHA_INGRESO: hoy, // nueva fecha de ingreso
          // FECHA_ACTIVACION: (conservar lo que tenía el original)
        };
        if (overrides) Object.assign(clone, overrides);
        docs.push(clone);
        perIdInserted[id] += 1;
      }
    }

    if (docs.length === 0) {
      return res
        .status(200)
        .json({ duplicated: 0, items: [], missingIds, perId: perIdInserted });
    }

    // Inserta en bloque
    const inserted = await Venta.insertMany(docs, { ordered: false });

    return res.status(201).json({
      duplicated: inserted.length,
      items: inserted,
      missingIds,
      perId: perIdInserted,
    });
  } catch (err) {
    console.error("❌ Error en duplicateVentas:", err);
    return res.status(500).json({ error: "Error al duplicar ventas" });
  }
}

function flattenDoc(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;

    if (v instanceof Date) {
      out[key] = v.toISOString().slice(0, 10); // o .toISOString() si prefieres
    } else if (Array.isArray(v)) {
      // Puedes cambiar a JSON.stringify(v) si prefieres 1 celda con JSON
      out[key] = v
        .map((x) =>
          x instanceof Date
            ? x.toISOString().slice(0, 10)
            : typeof x === "object" && x !== null
            ? JSON.stringify(x)
            : x ?? ""
        )
        .join(", ");
    } else if (v && typeof v === "object") {
      Object.assign(out, flattenDoc(v, key));
    } else {
      out[key] = v ?? ""; // deja vacío si null/undefined
    }
  }
  return out;
}

// arriba: import XLSX from 'xlsx' (o const XLSX = require('xlsx'))

export async function exportVentas(req, res) {
  try {
    const { estado, year, month, producto, tipoVenta, pdv, search } = req.query;

    // ---------- 1) Construir query (igual que antes) ----------
    const query = {};
    const estados = asArr(estado);
    if (estados.length) query["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) query.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      query["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(query, pdvMatch);

    // Año/Mes con regex sobre FECHA_ACTIVACION (yyyy-mm-dd o yyyy-mm)
    const ys = asArr(year).map((y) => String(y).padStart(4, "0"));
    const ms = asArr(month).map((m) => String(m).padStart(2, "0"));
    if (ys.length) {
      if (ms.length === 0) {
        query.FECHA_ACTIVACION = {
          $regex: new RegExp(`^(${ys.map(escRe).join("|")})`),
        };
      } else if (ys.length === 1) {
        query.FECHA_ACTIVACION = {
          $regex: new RegExp(`^${escRe(ys[0])}-(?:${ms.map(escRe).join("|")})`),
        };
      } else {
        query.$or = ys.map((y) => ({
          FECHA_ACTIVACION: {
            $regex: new RegExp(`^${escRe(y)}-(?:${ms.map(escRe).join("|")})`),
          },
        }));
      }
    } else if (ms.length) {
      query.FECHA_ACTIVACION = {
        $regex: new RegExp(`^\\d{4}-(?:${ms.map(escRe).join("|")})`),
      };
    }

    // 🔎 Búsqueda libre
    if (search) {
      const term = String(search).trim();
      if (term) {
        const regex = new RegExp(escRe(term), "i");
        query.$or = [
          { RUC: regex },
          { "RAZON SOCIAL CLIENTE": regex },
          { CONSULTORES: regex },
          { SUPERVISOR: regex },
          { "CONSULTOR REGISTRADO": regex },
          { SEGMENTO: regex },
          { PRODUCTO: regex },
        ];
      }
    }

    // ---------- 2) Traer datos ----------
    const raw = await Venta.find(query)
      .select("-__v")
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    // ---------- 3) Columnas visibles (mismas que tu tabla React) ----------
    const COLUMN_ORDER = [
      "fechaIngreso",
      "fechaActivacion",
      "ruc",
      "razonSocial",
      "segmento",
      "estadoFinal",
      "motivoRechazo",

      "consultores",
      "dniConsultor",
      "supervisor",
      "consultorRegistrado",

      "plan",
      "dsctoFacturacion",
      "tipoV",
      "producto",
      "pdv",

      "q",
      "cfSinIgv",
      "cfConIgv",
      "cfDescSinIgv",
      "cfDescConIgv",

      "equipo",
      "costoEquipo",
      "lineas",

      "secProyectoSot",

      "cuenta",

      "salesforce",
      "loteo",

      "distrito",

      "nombre",
      "numero",
      "correo",
      "nombre2",
      "numero3",
      "correo4",
    ];

    const HEADERS_MAP = {
      fechaIngreso: "Fecha de Ingreso",
      fechaActivacion: "Fecha de Activación",
      ruc: "RUC",
      razonSocial: "Razón Social",
      segmento: "Segmento",

      estadoFinal: "Estado Final",
      motivoRechazo: "Motivo Rechazo",
      secProyectoSot: "Sec. Proyecto SOT",

      tipoV: "Tipo de Venta",
      producto: "Producto",
      lineas: "Líneas",
      cuenta: "Cuenta",
      equipo: "Equipo",
      salesforce: "Salesforce",
      loteo: "Loteo",

      consultores: "Consultores",
      dniConsultor: "DNI Consultor",
      supervisor: "Supervisor",
      consultorRegistrado: "Consultor Registrado",

      q: "Q de Lineas",

      // 👇 Estas dos se llenarán con CF FACTURACIÓN si existe:
      cfSinIgv: "CF sin IGV",
      cfConIgv: "CF con IGV",

      // 👇 También exportamos los campos explícitos de facturación (descuento):
      cfDescSinIgv: "CF Descuento sin IGV",
      cfDescConIgv: "CF Descuento con IGV",

      distrito: "Distrito",
      plan: "Plan",
      costoEquipo: "Costo Equipo",
      pdv: "PDV",

      dsctoFacturacion: "Descuento Facturación",

      nombre: "Nombre",
      numero: "Número",
      correo: "Correo",
      nombre2: "Nombre 2",
      numero3: "Número 2",
      correo4: "Correo 2",
    };

    // ---------- 4) Normalizar cada venta a las claves camelCase de la tabla ----------
    const norm = (d) => {
      const cfDescSin = numOrBlank(d["CF FACTURACION DSCTO SIN IGV"]);
      const cfDescCon = numOrBlank(d["CF FACTURACION DSCTO CON IGV"]);
      const cfSinBase = numOrBlank(d["CF SIN IGV"]);
      const cfConBase = numOrBlank(d["CF INC IGV"]);

      // 👉 Mantener los CF base separados de los de facturación (descuento)
      const cfSinIgv = cfSinBase;
      const cfConIgv = cfConBase;

      return {
        fechaIngreso: strOrBlank(d["FECHA_INGRESO"]),
        fechaActivacion: strOrBlank(d["FECHA_ACTIVACION"]),
        ruc: strOrBlank(d["RUC"]),
        razonSocial: strOrBlank(d["RAZON SOCIAL CLIENTE"]),
        segmento: strOrBlank(d["SEGMENTO"]),

        estadoFinal: strOrBlank(d["ESTADO FINAL"]),
        motivoRechazo: strOrBlank(d["MOTIVO RECHAZO"]),
        secProyectoSot: strOrBlank(d["SEC_PROYECTO_SOT"]),

        tipoV: strOrBlank(d["TIPO_V"]),
        producto: strOrBlank(d["PRODUCTO"]),
        lineas: strOrBlank(d["LINEAS"]),
        cuenta: strOrBlank(d["CUENTA"]),
        equipo: strOrBlank(d["EQUIPO"]),
        salesforce: strOrBlank(d["SALESFORCE"]),
        loteo: strOrBlank(d["Loteo"]),

        consultores: strOrBlank(d["CONSULTORES"]),
        dniConsultor: strOrBlank(d["DNI_CONSULTOR"]),
        supervisor: strOrBlank(d["SUPERVISOR"]),
        consultorRegistrado: strOrBlank(d["CONSULTOR REGISTRADO"]),

        q: numOrBlank(d["Q"]),

        // 👇 CF visibles (usan CF FACTURACIÓN si existe)
        cfSinIgv,
        cfConIgv,

        // 👇 CF facturación (se exportan también, como columnas separadas)
        cfDescSinIgv: cfDescSin,
        cfDescConIgv: cfDescCon,

        distrito: strOrBlank(d["DISTRITO"]),
        plan: strOrBlank(d["PLAN"]),
        costoEquipo: numOrBlank(d["COSTO EQUIPO"]),
        pdv: strOrBlank(d["PDV"]),

        dsctoFacturacion: strOrBlank(d["DSCTO FACTURACION"]),

        nombre: strOrBlank(d["NOMBRE"]),
        numero: strOrBlank(d["NUMERO"]),
        correo: strOrBlank(d["CORREO"]),
        nombre2: strOrBlank(d["NOMBRE2"]),
        numero3: strOrBlank(d["NUMERO3"]),
        correo4: strOrBlank(d["CORREO4"]),
      };
    };

    const strOrBlank = (v) => (v == null ? "" : String(v));
    const numOrBlank = (v) => {
      if (v == null || v === "") return "";
      const n = Number(String(v).toString().replace(",", "."));
      return Number.isFinite(n) ? n : String(v);
    };

    // ---------- 5) Preparar filas para Excel con headers legibles ----------
    const normalized = raw.map(norm);

    const headersForExcel = COLUMN_ORDER.map((k) => HEADERS_MAP[k] ?? k);
    const rows = normalized.map((row) => {
      const out = {};
      for (const key of COLUMN_ORDER) {
        out[HEADERS_MAP[key] ?? key] = row[key] ?? "";
      }
      return out;
    });

    // ---------- 6) Escribir XLSX ----------
    const ws = XLSX.utils.json_to_sheet(rows, { header: headersForExcel });
    ws["!cols"] = headersForExcel.map((h) => ({
      wch: Math.max(12, String(h).length + 2),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const fname = `ReporteVentas(${fechaHoy}).xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("❌ Error en exportVentas:", err);
    return res.status(500).json({ error: "Error al exportar ventas" });
  }
}

export async function getComparativa(req, res) {
  try {
    const {
      tipo = "anual",
      year = new Date().getFullYear(),
      mes,
      trimestre,
      estado,
      producto,
      tipoVenta,
      pdv,
      cfMode,
    } = req.query;
    const CF_FIELD = getCfField(cfMode); // ⬅️ usar campo según cfMode

    // Filtros adicionales
    const matchExtra = {};
    const estados = asArr(estado);
    if (estados.length) {
      matchExtra["ESTADO FINAL"] = {
        $in: estados.map((e) => new RegExp(`^\\s*${escRe(e)}\\s*$`, "i")),
      };
    }

    const productos = asArr(producto);
    if (productos.length) matchExtra.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      matchExtra["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(matchExtra, pdvMatch);

    const pipelineBase = [addFaStage];

    let filtroActual = null;
    let filtroPasado = null;

    if (tipo === "anual") {
      const hoy = new Date();
      const mesActual = hoy.getMonth() + 1;
      filtroActual = buildYearMonthOr(
        [year],
        Array.from({ length: mesActual }, (_, i) => i + 1)
      );
      filtroPasado = buildYearMonthOr(
        [year - 1],
        Array.from({ length: mesActual }, (_, i) => i + 1)
      );
    }

    if (tipo === "mes" && mes) {
      filtroActual = buildYearMonthOr([year], [mes]);
      filtroPasado = buildYearMonthOr([year - 1], [mes]);
    }

    if (tipo === "trimestre" && trimestre) {
      const ranges = {
        1: [1, 2, 3],
        2: [4, 5, 6],
        3: [7, 8, 9],
        4: [10, 11, 12],
      };
      filtroActual = buildYearMonthOr([year], ranges[trimestre]);
      filtroPasado = buildYearMonthOr([year - 1], ranges[trimestre]);
    }

    const actual = await Venta.aggregate([
      ...pipelineBase,
      { $match: { ...matchExtra, ...(filtroActual || {}) } },
      {
        $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: `$${CF_FIELD}` } },
      },
    ]);

    const pasado = await Venta.aggregate([
      ...pipelineBase,
      { $match: { ...matchExtra, ...(filtroPasado || {}) } },
      {
        $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: `$${CF_FIELD}` } },
      },
    ]);

    res.json({
      data: [
        {
          name: "Q",
          pasado: pasado[0]?.Q || 0,
          actual: actual[0]?.Q || 0,
          variacion:
            (((actual[0]?.Q || 0) - (pasado[0]?.Q || 0)) /
              Math.max(1, pasado[0]?.Q || 1)) *
            100,
        },
        {
          name: "CF",
          pasado: pasado[0]?.CF || 0,
          actual: actual[0]?.CF || 0,
          variacion:
            (((actual[0]?.CF || 0) - (pasado[0]?.CF || 0)) /
              Math.max(1, pasado[0]?.CF || 1)) *
            100,
        },
      ],
    });
  } catch (err) {
    console.error("❌ Error en getComparativa:", err);
    res.status(500).json({ error: "Error en comparativa" });
  }
}

export async function getMesVsYTD(req, res) {
  try {
    const {
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      estado,
      producto,
      tipoVenta,
      pdv,
      cfMode,
    } = req.query;
    const CF_FIELD = getCfField(cfMode);

    const mesNum = String(month).padStart(2, "0");

    // Filtros adicionales
    const matchExtra = {};
    const estados = asArr(estado);
    if (estados.length) matchExtra["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) matchExtra.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length)
      matchExtra["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(matchExtra, pdvMatch);

    const pipelineBase = [addFaStage];

    const ytd = await Venta.aggregate([
      ...pipelineBase,
      {
        $match: {
          fa: {
            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
            $lte: new Date(),
          },
          ...matchExtra,
        },
      },
      {
        $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: `$${CF_FIELD}` } },
      },
    ]);

    const mesAgg = await Venta.aggregate([
      ...pipelineBase,
      {
        $match: {
          fa: {
            $gte: new Date(`${year}-${mesNum}-01T00:00:00.000Z`),
            $lt: new Date(year, month, 1),
          },
          ...matchExtra,
        },
      },
      {
        $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: `$${CF_FIELD}` } },
      },
    ]);

    res.json({
      meta: { year, month },
      ytd: { Q: ytd[0]?.Q || 0, CF: ytd[0]?.CF || 0 },
      mes: { Q: mesAgg[0]?.Q || 0, CF: mesAgg[0]?.CF || 0 },
    });
  } catch (err) {
    console.error("❌ Error en getMesVsYTD:", err);
    res.status(500).json({ error: "Error en mes-vs-ytd" });
  }
}

export async function getVentasPorProducto(req, res) {
  try {
    const { estado, year, month, producto, tipoVenta, pdv, cfMode } = req.query;
    const CF_FIELD = getCfField(cfMode); // "CF SIN IGV" | "CF FACTURACION DSCTO SIN IGV
    const match = {};

    // Estado Final
    const estados = asArr(estado);
    if (estados.length) {
      match["ESTADO FINAL"] = {
        $in: estados.map((e) => new RegExp(`^\\s*${escRe(e)}\\s*$`, "i")),
      };
    }

    // Producto
    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    // Tipo de Venta
    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    // PDV
    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    // Año/Mes
    // Año/Mes
    const yearsArr = asArr(year).map((y) => parseInt(y, 10));
    const monthsArr = asArr(month).map((m) => parseInt(m, 10));

    const pipeline = [addFaStage, { $match: match }];

    const dateOr = buildYearMonthOr(yearsArr, monthsArr);

    if (yearsArr.length || monthsArr.length) {
      pipeline.push({
        $match: {
          $expr: {
            $and: [
              ...(yearsArr.length
                ? [{ $in: [{ $year: "$fa" }, yearsArr] }]
                : []),
              ...(monthsArr.length
                ? [{ $in: [{ $month: "$fa" }, monthsArr] }]
                : []),
            ],
          },
        },
      });
    }

    pipeline.push(
      {
        $project: {
          year: { $year: "$fa" },
          month: { $month: "$fa" },
          producto: "$PRODUCTO",
          tipo: "$TIPO_V",
          totalCF: { $ifNull: [`$${CF_FIELD}`, 0] },
          Q: { $ifNull: ["$Q", 0] },
        },
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
            producto: "$producto",
            tipo: "$tipo",
          },
          totalCF: { $sum: "$totalCF" },
          Q: { $sum: "$Q" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.producto": 1 } }
    );

    const raw = await Venta.aggregate(pipeline).allowDiskUse(true);

    const data = raw.map((r) => ({
      year: r._id.year,
      month: r._id.month,
      producto: r._id.producto,
      tipo: r._id.tipo,
      totalCF: r.totalCF,
      Q: r.Q,
    }));

    res.json(data);
  } catch (err) {
    console.error("❌ Error en getVentasPorProducto:", err);
    res.status(500).json({ error: "Error al obtener ventas por producto" });
  }
}

export async function getVentasPorConsultor(req, res) {
  try {
    const asArr = (v) =>
      (Array.isArray(v) ? v : v != null ? [v] : []).filter(Boolean);
    const escRe = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const addFaStage = {
      $addFields: {
        fa: {
          $toDate: {
            $ifNull: [
              "$FECHA_ACTIVACION",
              {
                $ifNull: [
                  "$fechaActivacion",
                  { $ifNull: ["$FECHA_INGRESO", "$fechaIngreso"] },
                ],
              },
            ],
          },
        },
      },
    };

    const { estado, year, month, producto, tipoVenta, consultor, pdv, cfMode } =
      req.query;
    const CF_FIELD = getCfField(cfMode); // "CF SIN IGV" | "CF FACTURACION DSCTO SIN IGV"

    const estados = asArr(estado);
    const productos = asArr(producto);
    const tipos = asArr(tipoVenta);
    const consultores = asArr(consultor);

    const yearsArr = asArr(year)
      .map((y) => parseInt(y, 10))
      .filter(Number.isFinite);
    const monthsArr = asArr(month)
      .map((m) => parseInt(m, 10))
      .filter(Number.isFinite);

    const YES = /^\s*s[ií]\s*$/i;
    const NO = /^\s*n[oó]\s*$/i;

    // === pipeline ===
    const pipeline = [
      addFaStage,
      {
        $project: {
          year: { $year: "$fa" },
          month: { $month: "$fa" },
          consultor: { $ifNull: ["$CONSULTORES", "$consultores"] },
          producto: { $ifNull: ["$PRODUCTO", "$producto"] },
          tipo: { $ifNull: ["$TIPO_V", "$tipoV"] },
          estado: { $ifNull: ["$ESTADO FINAL", "$estadoFinal"] },
          pdv: { $ifNull: ["$PDV", "$pdv"] },
          totalCF: {
            $ifNull: [`$${CF_FIELD}`, { $ifNull: ["$cfSinIgv", 0] }],
          },
          Q: { $ifNull: ["$Q", "$q"] },
        },
      },
    ];

    const and = [];

    if (estados.length) {
      const regs = estados.map((e) => new RegExp(`^\\s*${escRe(e)}\\s*$`, "i"));
      and.push({ estado: { $in: regs } });
    }

    if (productos.length) and.push({ producto: { $in: productos } });

    if (tipos.length) {
      const regs = tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i"));
      and.push({ tipo: { $in: regs } });
    }

    if (consultores.length) {
      const regs = consultores.map(
        (c) => new RegExp(`^\\s*${escRe(c)}\\s*$`, "i")
      );
      and.push({ consultor: { $in: regs } });
    }

    if (pdv) {
      if (YES.test(pdv)) and.push({ pdv: { $regex: YES } });
      else if (NO.test(pdv)) and.push({ pdv: { $regex: NO } });
    }

    if (yearsArr.length || monthsArr.length) {
      and.push({
        $expr: {
          $and: [
            ...(yearsArr.length ? [{ $in: ["$year", yearsArr] }] : []),
            ...(monthsArr.length ? [{ $in: ["$month", monthsArr] }] : []),
          ],
        },
      });
    }

    if (and.length) pipeline.push({ $match: { $and: and } });

    pipeline.push(
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
            consultor: "$consultor",
            tipo: "$tipo",
            producto: "$producto",
          },
          totalCF: { $sum: "$totalCF" },
          Q: { $sum: "$Q" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.consultor": 1,
          "_id.tipo": 1,
          "_id.producto": 1,
        },
      }
    );

    const raw = await Venta.aggregate(pipeline).allowDiskUse(true);

    const data = raw.map((r) => ({
      year: r._id.year,
      month: r._id.month,
      consultor: r._id.consultor || "",
      tipo: r._id.tipo || "",
      producto: r._id.producto || "",
      totalCF: r.totalCF || 0,
      Q: r.Q || 0,
    }));

    res.json(data);
  } catch (err) {
    console.error("❌ Error en getVentasPorConsultor:", err);
    res.status(500).json({ error: "Error al obtener ventas por consultor" });
  }
}

/* ────────────────────── GET /ventas/consultor-progreso ──────────────────────
   Serie por meses (01..12) de Q y CF para un consultor (por nombre o userId) */
export async function getProgresoConsultor(req, res) {
  try {
    const {
      consultor,
      userId,
      year = new Date().getFullYear(),
      estado,
      producto,
      tipoVenta,
      pdv,
      cfMode,
    } = req.query;

    // 1) Resolver nombre objetivo
    let targetName = (consultor || "").trim();
    if (!targetName && userId) {
      const u = await User.findById(userId)
        .populate("role", "name nombre slug _id")
        .lean();
      if (u) targetName = displayFromUser(u);
    }
    const targetLower = targetName.toLowerCase();

    // 2) Filtros básicos
    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    // 3) Rango de año (este sí puede usar índice sobre 'fa' si lo tienes)
    const y = parseInt(year, 10);
    const start = new Date(
      `${y.toString().padStart(4, "0")}-01-01T00:00:00.000Z`
    );
    const end = new Date(
      `${(y + 1).toString().padStart(4, "0")}-01-01T00:00:00.000Z`
    );

    const CF_FIELD = getCfField(cfMode);

    const pipeline = [
      // A) Solo añadimos 'fa' y cortamos por fecha + filtros lo antes posible
      addFaStage,
      { $match: { ...match, fa: { $gte: start, $lt: end } } },

      // B) Normalizamos consultor en una sola pasada y proyectamos únicamente lo que usamos
      {
        $project: {
          monthNum: { $month: "$fa" }, // número 1..12 (más barato que dateToString)
          consultorLower: {
            $toLower: {
              $trim: {
                input: {
                  $toString: {
                    $ifNull: [
                      "$CONSULTORES",
                      { $ifNull: ["$consultores", ""] },
                    ],
                  },
                },
              },
            },
          },
          CF: { $ifNull: [`$${CF_FIELD}`, 0] },
          Q: { $ifNull: ["$Q", 0] },
        },
      },

      // C) Igualdad (case-insensitive) sin regex
      { $match: { consultorLower: targetLower } },

      // D) Agrupamos directo por mes (número), sumas simples
      {
        $group: {
          _id: "$monthNum",
          totalCF: { $sum: "$CF" },
          totalQ: { $sum: "$Q" },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const raw = await Venta.aggregate(pipeline).allowDiskUse(true);

    // 4) Formateo a 12 meses
    const map = Object.fromEntries(raw.map((r) => [r._id, r]));
    const data = Array.from({ length: 12 }, (_, i) => {
      const mm = i + 1; // 1..12
      return {
        mes: String(mm).padStart(2, "0"),
        CF: Number(map[mm]?.totalCF || 0),
        Q: Number(map[mm]?.totalQ || 0),
      };
    });

    return res.json({
      meta: {
        year: y,
        consultor: targetName || null,
        consultorNorm: normalizeName(targetName),
      },
      data,
    });
  } catch (err) {
    console.error("❌ Error en getProgresoConsultor:", err);
    return res.status(500).json({ error: "Error en progreso del consultor" });
  }
}

export async function getRankingConsultores(req, res) {
  try {
    const {
      estado,
      year,
      month,
      producto,
      tipoVenta,
      pdv,
      sortBy = "Q",
      cfMode,
    } = req.query;

    // 1) Comerci ales activos
    const activos = await User.find({ estadoUsuario: ESTADO_ACTIVO_ID })
      .populate("role", "name nombre slug _id")
      .select("name firstName lastName role")
      .lean();

    const comerciales = activos.filter(isComercialDoc);
    const usersByNorm = new Map(
      comerciales.map((u) => [normalizeName(displayFromUser(u)), u])
    );

    // 2) Filtros de ventas
    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    const yearsArr = asArr(year)
      .map((y) => parseInt(y, 10))
      .filter(Number.isFinite);
    const monthsArr = asArr(month)
      .map((m) => parseInt(m, 10))
      .filter(Number.isFinite);

    const CF_FIELD = getCfField(cfMode);

    // 3) Pipeline
    const pipeline = [addFaStage, { $match: match }];

    if (yearsArr.length || monthsArr.length) {
      pipeline.push({
        $match: {
          $expr: {
            $and: [
              ...(yearsArr.length
                ? [{ $in: [{ $year: "$fa" }, yearsArr] }]
                : []),
              ...(monthsArr.length
                ? [{ $in: [{ $month: "$fa" }, monthsArr] }]
                : []),
            ],
          },
        },
      });
    }

    pipeline.push(
      // Proyectamos lo mínimo y normalizamos consultor de forma segura
      {
        $project: {
          consultorDisplay: {
            $trim: {
              input: {
                $convert: {
                  input: {
                    $ifNull: [
                      "$CONSULTORES",
                      { $ifNull: ["$consultores", ""] },
                    ],
                  },
                  to: "string",
                  onError: "",
                  onNull: "",
                },
              },
            },
          },
          consultorNorm: {
            $toLower: {
              $trim: {
                input: {
                  $convert: {
                    input: {
                      $ifNull: [
                        "$CONSULTORES",
                        { $ifNull: ["$consultores", ""] },
                      ],
                    },
                    to: "string",
                    onError: "",
                    onNull: "",
                  },
                },
              },
            },
          },
          CF: { $ifNull: [`$${CF_FIELD}`, 0] },
          Q: { $ifNull: ["$Q", 0] },
        },
      },
      // Agrupamos por el nombre normalizado (case-insensitive/coherente)
      {
        $group: {
          _id: "$consultorNorm",
          consultor: { $first: "$consultorDisplay" }, // para mostrar
          totalCF: { $sum: "$CF" },
          totalQ: { $sum: "$Q" },
        },
      }
    );

    const agg = await Venta.aggregate(pipeline).allowDiskUse(true);

    // 4) Merge con usuarios (comerciales sin ventas → 0)
    const byNorm = new Map();
    for (const r of agg) {
      const norm = normalizeName(r._id || "");
      byNorm.set(norm, {
        consultor:
          r.consultor ||
          (usersByNorm.get(norm) ? displayFromUser(usersByNorm.get(norm)) : ""),
        userId: usersByNorm.get(norm)?._id || null,
        totalCF: Number(r.totalCF || 0),
        totalQ: Number(r.totalQ || 0),
      });
    }

    for (const [norm, u] of usersByNorm.entries()) {
      if (!byNorm.has(norm)) {
        byNorm.set(norm, {
          consultor: displayFromUser(u),
          userId: u._id,
          totalCF: 0,
          totalQ: 0,
        });
      }
    }

    // 5) Orden
    let data = Array.from(byNorm.values());
    if (sortBy === "CF") {
      data.sort(
        (a, b) =>
          b.totalCF - a.totalCF || a.consultor.localeCompare(b.consultor)
      );
    } else if (sortBy === "Q") {
      data.sort(
        (a, b) => b.totalQ - a.totalQ || a.consultor.localeCompare(b.consultor)
      );
    } else {
      data.sort((a, b) => a.consultor.localeCompare(b.consultor));
    }

    return res.json({ data });
  } catch (err) {
    console.error("❌ Error en getRankingConsultores:", err);
    return res.status(500).json({ error: "Error en ranking de consultores" });
  }
}
