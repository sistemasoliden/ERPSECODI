// backend/controllers/ventaController.js
import Venta from "../models/Venta.js";
import * as XLSX from "xlsx";
import { Readable } from "stream";

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

/* ─────────────────────────── CREATE ─────────────────────────── */
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
      fechaActivacion = estadoFinal.toLowerCase() === "aprobado" ? hoy : "";
    }

    const Q = toInt(pick("Q", "q"));
    const cfSinIgv = toFloat(pick("CF SIN IGV", "cfSinIgv", "cf_sin_igv"));
    let cfIncIgv = toFloat(
      pick("CF INC IGV", "CF CON IGV", "cfConIgv", "cf_inc_igv")
    );
    if (cfIncIgv === null && cfSinIgv !== null)
      cfIncIgv = +(cfSinIgv * 1.18).toFixed(2);

    let pcSinIgv = toFloat(pick("PC SIN IGV", "pcSinIgv"));
    let pcConIgv = toFloat(pick("PC CON IGV", "pcConIgv"));
    if (pcSinIgv === null) pcSinIgv = cfSinIgv ?? null;
    if (pcConIgv === null) pcConIgv = cfIncIgv ?? null;

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

      DISTRITO: distrito,
      PLAN: plan,
      "COSTO EQUIPO": costoEquipo,
      PDV: pdv,
      "MOTIVO RECHAZO": motivoRechazo,
      SEGMENTO: segmento,
      "DSCTO FACTURACION": dsctoFact,

      "PC SIN IGV": pcSinIgv,
      "PC CON IGV": pcConIgv,

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
// backend/controllers/ventaController.js
// backend/controllers/ventaController.js
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
        // Solo años
        query.FECHA_ACTIVACION = {
          $regex: new RegExp(`^(${ys.map(escRe).join("|")})`),
        };
      } else if (ys.length === 1) {
        // Año + meses
        query.FECHA_ACTIVACION = {
          $regex: new RegExp(`^${escRe(ys[0])}-(?:${ms.map(escRe).join("|")})`),
        };
      } else {
        // Varios años (con o sin meses)
        query.$or = ys.map((y) => ({
          FECHA_ACTIVACION: {
            $regex: ms.length
              ? new RegExp(`^${escRe(y)}-(?:${ms.map(escRe).join("|")})`)
              : new RegExp(`^${escRe(y)}`),
          },
        }));
      }
    } else if (ms.length) {
      // Solo meses (cualquier año)
      query.FECHA_ACTIVACION = {
        $regex: new RegExp(`^\\d{4}-(?:${ms.map(escRe).join("|")})`),
      };
    }

    // 🔎 Búsqueda global
    // 🔎 Búsqueda global
    // 🔎 Búsqueda global
    if (req.query.search) {
      const search = req.query.search.trim();
      const regex = new RegExp(escRe(search), "i"); // insensitive

      // si es numérico, lo guardamos
      const maybeNumber = Number(search);
      const isNumeric = !isNaN(maybeNumber);

      query.$or = [
        // Strings
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

        // Números convertidos a string (por si acaso Mongo los guarda como texto en algún doc)
        { RUC: regex },
        { LINEAS: regex },
        { Q: regex },

        // Si es número, también buscamos coincidencia exacta
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
      addFaStage, // ⬅️ convierte FECHA_ACTIVACION a Date en campo "fa"
      { $sort: { fa: -1, _id: -1 } }, // ⬅️ orden estable
      { $skip: skip },
      { $limit: limit },
      { $project: { __v: 0 } },
    ];

    const data = await Venta.aggregate(pipeline).allowDiskUse(true);

    /* ---------- Normalización ---------- */
    const normalized = data.map((v) => ({
      // básicos
      _id: v._id, // asegúrate de mantener el ID original de Mongo
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
      pcSinIgv: v["PC SIN IGV"],
      pcConIgv: v["PC CON IGV"],

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
    const { estado, year, month, producto, tipoVenta, pdv } = req.query;

    const match = {};

    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length)
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    const yearsArr = asArr(year);
    const monthsArr = asArr(month);
    const monthsPadded = monthsArr.map(pad2);

    const pipeline = [{ $match: match }, addFaStage];

    const dateOr = buildYearMonthOr(yearsArr, monthsArr);
    if (dateOr) {
      pipeline.push({ $match: dateOr });
    } else if (!yearsArr.length && monthsPadded.length) {
      // ✅ Solo meses (cualquier año) — filtra por %m
      pipeline.push({
        $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
      });
      pipeline.push({ $match: { mm: { $in: monthsPadded } } });
    }

    pipeline.push(
      {
        $project: {
          mes: { $dateToString: { format: "%m", date: "$fa" } },
          CF: { $ifNull: ["$CF SIN IGV", 0] },
          Q: { $ifNull: ["$Q", 0] },
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
      CF: +(map[mm]?.totalCF || 0),
      Q: +(map[mm]?.totalQ || 0),
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
    const { estado, year, month, producto, tipoVenta, pdv } = req.query;

    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length)
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    const yearsArr = asArr(year);
    const monthsArr = asArr(month);
    const monthsPadded = monthsArr.map(pad2);

    const pipeline = [{ $match: match }, addFaStage];

    const dateOr = buildYearMonthOr(yearsArr, monthsArr);
    if (dateOr) {
      pipeline.push({ $match: dateOr });
    } else if (!yearsArr.length && monthsPadded.length) {
      pipeline.push({
        $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
      });
      pipeline.push({ $match: { mm: { $in: monthsPadded } } });
    }

    pipeline.push(
      {
        $group: {
          _id: "$ESTADO FINAL",
          totalCF: { $sum: { $ifNull: ["$CF SIN IGV", 0] } },
          totalQ: { $sum: { $ifNull: ["$Q", 0] } },
        },
      },
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
    const { estado, year, month, producto, tipoVenta, pdv, detallePor, tipo } =
      req.query;

    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tiposFiltro = asArr(tipoVenta);
    if (tiposFiltro.length)
      match["TIPO_V"] = {
        $in: tiposFiltro.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) Object.assign(match, pdvMatch);

    // Drill down: detallePor=tipoVenta & tipo=<TIPO_V>
    const isDrill = detallePor === "tipoVenta" && !!tipo;
    if (isDrill) match["TIPO_V"] = new RegExp(`^\\s*${escRe(tipo)}\\s*$`, "i");

    const yearsArr = asArr(year);
    const monthsArr = asArr(month);
    const monthsPadded = monthsArr.map(pad2);

    const pipeline = [{ $match: match }, addFaStage];

    const dateOr = buildYearMonthOr(yearsArr, monthsArr);
    if (dateOr) {
      pipeline.push({ $match: dateOr });
    } else if (!yearsArr.length && monthsPadded.length) {
      pipeline.push({
        $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
      });
      pipeline.push({ $match: { mm: { $in: monthsPadded } } });
    }

    pipeline.push(
      {
        $group: {
          _id: isDrill ? "$TIPO DE VENTA" : "$TIPO_V",
          totalReg: { $sum: 1 },
          totalQ: { $sum: { $ifNull: ["$Q", 0] } },
          totalCF: { $sum: { $ifNull: ["$CF SIN IGV", 0] } },
        },
      },
      { $sort: { totalReg: -1 } }
    );

    const raw = await Venta.aggregate(pipeline).allowDiskUse(true);
    const data = raw
      .filter((r) => r._id && String(r._id).trim() !== "")
      .map((r) => ({
        name: r._id,
        totalReg: r.totalReg,
        totalQ: r.totalQ,
        totalCF: r.totalCF,
      }));

    res.json({ data });
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
    const { estado, year, month, producto, tipoVenta, pdvOnly } = req.query;

    const match = {};
    const estados = asArr(estado);
    if (estados.length) match["ESTADO FINAL"] = { $in: estados };

    const productos = asArr(producto);
    if (productos.length) match.PRODUCTO = { $in: productos };

    const tipos = asArr(tipoVenta);
    if (tipos.length)
      match["TIPO_V"] = {
        $in: tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i")),
      };

    const yearsArr = asArr(year);
    const monthsArr = asArr(month);
    const monthsPadded = monthsArr.map(pad2);

    const pipeline = [{ $match: match }, addFaStage];

    const dateOr = buildYearMonthOr(yearsArr, monthsArr);
    if (dateOr) {
      pipeline.push({ $match: dateOr });
    } else if (!yearsArr.length && monthsPadded.length) {
      pipeline.push({
        $addFields: { mm: { $dateToString: { format: "%m", date: "$fa" } } },
      });
      pipeline.push({ $match: { mm: { $in: monthsPadded } } });
    }

    // Buckets PDV
    pipeline.push(
      {
        $addFields: {
          isPDV: {
            $regexMatch: {
              input: { $ifNull: ["$PDV", ""] },
              regex: /^\s*s[ií]\s*$/i,
            },
          },
        },
      },
      ...(pdvOnly === "true" ? [{ $match: { isPDV: true } }] : []),
      {
        $group: {
          _id: "$isPDV",
          totalCF: { $sum: { $ifNull: ["$CF SIN IGV", 0] } },
          totalQ: { $sum: { $ifNull: ["$Q", 0] } },
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
      const bucket = r._id === true ? 0 : 1;
      data[bucket].totalCF = Number(r.totalCF || 0);
      data[bucket].totalQ = Number(r.totalQ || 0);
      data[bucket].total = Number(r.total || 0);
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

    // Construimos $set solo con lo que realmente viene en el body
    const $set = {};

    // Básicos (NO tocamos FECHA_INGRESO aquí)
    if (pick("razonSocial", "RAZON SOCIAL CLIENTE") !== undefined)
      $set["RAZON SOCIAL CLIENTE"] = pick(
        "razonSocial",
        "RAZON SOCIAL CLIENTE"
      );

    if (pick("ruc", "RUC") !== undefined) $set["RUC"] = pick("ruc", "RUC");

    if (pick("secProyectoSot", "SEC_PROYECTO_SOT") !== undefined)
      $set["SEC_PROYECTO_SOT"] = pick("secProyectoSot", "SEC_PROYECTO_SOT");

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

    // Números
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

    const pcSin = toFloat(pick("pcSinIgv", "PC SIN IGV"));
    if (pcSin !== undefined) $set["PC SIN IGV"] = pcSin;

    let pcCon = toFloat(pick("pcConIgv", "PC CON IGV"));
    if (pcCon === undefined && pcSin !== undefined)
      pcCon = +(pcSin * 1.18).toFixed(2);
    if (pcCon !== undefined) $set["PC CON IGV"] = pcCon;

    // Detalle
    if (pick("distrito", "DISTRITO") !== undefined)
      $set["DISTRITO"] = pick("distrito", "DISTRITO");
    if (pick("plan", "PLAN") !== undefined) $set["PLAN"] = pick("plan", "PLAN");

    const costo = toFloat(pick("costoEquipo", "COSTO EQUIPO", "COSTO_EQUIPO"));
    if (costo !== undefined) $set["COSTO EQUIPO"] = costo;

    // PDV normalizado: "Sí" o "" (como ya haces en create)
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

    // Segmento (por nombre)
    if (pick("segmento", "SEGMENTO") !== undefined)
      $set["SEGMENTO"] = pick("segmento", "SEGMENTO");

    // Contactos
    ["NOMBRE", "CORREO", "NUMERO", "NOMBRE2", "CORREO4", "NUMERO3"].forEach(
      (k) => {
        if (pick(k, k.toLowerCase()) !== undefined)
          $set[k] = pick(k, k.toLowerCase());
      }
    );

    // Si no hay nada que actualizar:
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
    // POST /ventas/duplicate  body: { ids: ["...","..."] }
    const ids = asArr(req.body?.ids);
    if (!ids.length) return res.status(400).json({ error: "IDs requeridos" });

    const originals = await Venta.find({ _id: { $in: ids } }).lean();

    if (!originals.length) return res.json({ duplicated: 0, items: [] });

    const hoy = new Date().toISOString().slice(0, 10);
    const docs = originals.map((o) => {
      const { _id, __v, createdAt, updatedAt, ...rest } = o;
      // Ajustes: nueva FECHA_INGRESO; FECHA_ACTIVACION se mantiene
      return {
        ...rest,
        FECHA_INGRESO: hoy,
      };
    });

    const inserted = await Venta.insertMany(docs);
    return res
      .status(201)
      .json({ duplicated: inserted.length, items: inserted });
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

    // --- arma query ---
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

    // Año/Mes
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

    // 🔎 Búsqueda libre (cuadro de búsqueda)
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

    // 1) Trae datos
    const raw = await Venta.find(query)
      .select("-__v")
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    // 2) Map de cabeceras legibles
    const HEAD = [
      "FECHA_INGRESO",
      "FECHA_ACTIVACION",
      "RUC",
      "RAZON SOCIAL CLIENTE",
      "ESTADO FINAL",
      "MOTIVO RECHAZO",
      "SEC_PROYECTO_SOT",
      "SEGMENTO",
      "TIPO_V",
      "PRODUCTO",
      "Q",
      "CF INC IGV",
      "CF SIN IGV",
      "CONSULTORES",
      "DNI_CONSULTOR",
      "CONSULTOR REGISTRADO",
      "SUPERVISOR",
      "SALESFORCE",
      "COSTO EQUIPO",
      "CUENTA",
      "DISTRITO",
      "DSCTO FACTURACION",
      "EQUIPO",
      "LINEAS",
      "Loteo",
      "PDV",
      "PLAN",
      "PC CON IGV",
      "PC SIN IGV",
      "NOMBRE",
      "NOMBRE2",
      "NUMERO",
      "NUMERO3",
      "CORREO",
      "CORREO4",
    ];

    const HEADERS_MAP = {
      FECHA_INGRESO: "Fecha de Ingreso",
      FECHA_ACTIVACION: "Fecha de Activación",
      RUC: "RUC",
      "RAZON SOCIAL CLIENTE": "Razón Social",
      "ESTADO FINAL": "Estado Final",
      "MOTIVO RECHAZO": "Motivo Rechazo",
      SEC_PROYECTO_SOT: "Sec. Proyecto SOT",
      SEGMENTO: "Segmento",
      TIPO_V: "Tipo de Venta",
      PRODUCTO: "Producto",
      Q: "Q de Líneas",
      "CF INC IGV": "CF con IGV",
      "CF SIN IGV": "CF sin IGV",
      CONSULTORES: "Consultores",
      DNI_CONSULTOR: "DNI Consultor",
      "CONSULTOR REGISTRADO": "Consultor Registrado",
      SUPERVISOR: "Supervisor",
      SALESFORCE: "Salesforce",
      "COSTO EQUIPO": "Costo Equipo",
      CUENTA: "Cuenta",
      DISTRITO: "Distrito",
      "DSCTO FACTURACION": "Descuento Facturación",
      EQUIPO: "Equipo",
      LINEAS: "Líneas",
      Loteo: "Loteo",
      PDV: "PDV",
      PLAN: "Plan",
      "PC CON IGV": "PC con IGV",
      "PC SIN IGV": "PC sin IGV",
      NOMBRE: "Nombre",
      NOMBRE2: "Nombre 2",
      NUMERO: "Número",
      NUMERO3: "Número 2",
      CORREO: "Correo",
      CORREO4: "Correo 2",
    };

    // 3) Filas con cabeceras legibles
    const rows = raw.map((d) => {
      const r = {};
      for (const k of HEAD) r[HEADERS_MAP[k] ?? k] = d[k] ?? "";
      return r;
    });

    const headersForExcel = HEAD.map((k) => HEADERS_MAP[k] ?? k);

    // 4) Genera excel
    const ws = XLSX.utils.json_to_sheet(rows, { header: headersForExcel });

    // auto-anchos
    const colWidths = headersForExcel.map((h) => ({
      wch: Math.max(12, String(h).length + 2),
    }));
    ws["!cols"] = colWidths;

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
    } = req.query;

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
      { $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: "$CF SIN IGV" } } },
    ]);

    const pasado = await Venta.aggregate([
      ...pipelineBase,
      { $match: { ...matchExtra, ...(filtroPasado || {}) } },
      { $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: "$CF SIN IGV" } } },
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
    } = req.query;

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
      { $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: "$CF SIN IGV" } } },
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
      { $group: { _id: null, Q: { $sum: "$Q" }, CF: { $sum: "$CF SIN IGV" } } },
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
    const { estado, year, month, producto, tipoVenta, pdv } = req.query;
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
          totalCF: { $ifNull: ["$CF SIN IGV", 0] },
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
    // === helpers inline ===
    const asArr = (v) =>
      (Array.isArray(v) ? v : v != null ? [v] : []).filter(Boolean);
    const escRe = (s = "") => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // fecha: prioriza fechaActivacion/FECHA_ACTIVACION y cae a fechaIngreso/FECHA_INGRESO
    const addFaStage = {
  $addFields: {
    fa: {
      $toDate: {
        $ifNull: [
          "$FECHA_ACTIVACION",
          {
            $ifNull: [
              "$fechaActivacion",
              {
                $ifNull: ["$FECHA_INGRESO", "$fechaIngreso"],
              },
            ],
          },
        ],
      },
    },
  },
};

    // PDV: boolean o "si"/"no" y campo pdv/PDV
    function buildPdvMatch(pdvParam) {
      if (pdvParam == null || pdvParam === "") return null;
      const yes = /^\s*s[ií]\s*$/i.test(String(pdvParam));
      const no = /^\s*n[oó]\s*$/i.test(String(pdvParam));
      if (!yes && !no) return null;
      const YES = /^\s*s[ií]\s*$/i;
      const NO = /^\s*n[oó]\s*$/i;
      return yes
        ? {
            $or: [
              { pdv: true },
              { PDV: true },
              { pdv: { $regex: YES } },
              { PDV: { $regex: YES } },
            ],
          }
        : {
            $or: [
              { pdv: false },
              { PDV: false },
              { pdv: { $regex: NO } },
              { PDV: { $regex: NO } },
            ],
          };
    }

    // === filtros ===
    const { estado, year, month, producto, tipoVenta, consultor, pdv } =
      req.query;

    const and = [];

    const estados = asArr(estado);
    if (estados.length) {
      const regs = estados.map((e) => new RegExp(`^\\s*${escRe(e)}\\s*$`, "i"));
      and.push({ $or: [{ "ESTADO FINAL": { $in: regs } }, { estadoFinal: { $in: regs } }] });
    }

    const productos = asArr(producto);
    if (productos.length) and.push({ $or: [{ PRODUCTO: { $in: productos } }, { producto: { $in: productos } }] });

    const tipos = asArr(tipoVenta);
    if (tipos.length) {
      const regs = tipos.map((t) => new RegExp(`^\\s*${escRe(t)}\\s*$`, "i"));
      and.push({ $or: [{ TIPO_V: { $in: regs } }, { tipoV: { $in: regs } }] });
    }

    const consultores = asArr(consultor);
    if (consultores.length) {
      const regs = consultores.map((c) => new RegExp(`^\\s*${escRe(c)}\\s*$`, "i"));
      and.push({ $or: [{ CONSULTORES: { $in: regs } }, { consultores: { $in: regs } }] });
    }

    const pdvMatch = buildPdvMatch(pdv);
    if (pdvMatch) and.push(pdvMatch);

    const yearsArr = asArr(year).map((y) => parseInt(y, 10)).filter(Number.isFinite);
    const monthsArr = asArr(month).map((m) => parseInt(m, 10)).filter(Number.isFinite);

    // === pipeline ===
    const pipeline = [addFaStage];
    if (and.length) pipeline.push({ $match: { $and: and } });

    if (yearsArr.length || monthsArr.length) {
      pipeline.push({
        $match: {
          $expr: {
            $and: [
              ...(yearsArr.length ? [{ $in: [{ $year: "$fa" }, yearsArr] }] : []),
              ...(monthsArr.length ? [{ $in: [{ $month: "$fa" }, monthsArr] }] : []),
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
          consultor: {
            $ifNull: ["$CONSULTORES", { $ifNull: ["$consultores", ""] }],
          },
          tipo: { $ifNull: ["$TIPO_V", { $ifNull: ["$tipoV", ""] }] },
          producto: { $ifNull: ["$PRODUCTO", { $ifNull: ["$producto", ""] }] },
          totalCF: {
            $ifNull: ["$CF SIN IGV", { $ifNull: ["$cfSinIgv", 0] }],
          },
          Q: { $ifNull: ["$Q", { $ifNull: ["$q", 0] }] },
        },
      },
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
