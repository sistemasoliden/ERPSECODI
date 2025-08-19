import express from "express";
import Venta from "../models/Venta.js";



const router = express.Router();

// 1) Obtener ventas con paginación
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      Venta.countDocuments(),
      Venta.find({}).skip(skip).limit(limit).lean()
    ]);

    res.json({ page, limit, total, data });
  } catch (err) {
    console.error("❌ Error al obtener ventas:", err);
    res.status(500).json({ error: "Error al obtener ventas" });
  }
});


router.post("/", async (req, res) => {
  try {
    // Guarda tal cual (schema strict:false), respeta las claves con espacios
    const venta = new Venta(req.body);
    await venta.save();
    res.status(201).json(venta);
  } catch (err) {
    console.error("❌ Error creando venta:", err);
    res.status(500).json({ error: "Error al crear venta" });
  }
});


// 2) Obtener lista única de estados finales
router.get("/estados", async (req, res) => {
  try {
    const estados = await Venta.distinct("ESTADO FINAL");
    res.json(estados);
  } catch (err) {
    console.error("❌ Error al obtener estados finales:", err);
    res.status(500).json({ error: "Error al obtener estados finales" });
  }
});

// 3) Resumen agrupado por año y mes, con filtro opcional por estado final
router.get("/resumen", async (req, res) => {
  try {
    const { estadoFinal } = req.query;

    const match = {};
    if (estadoFinal) {
      match["ESTADO FINAL"] = estadoFinal;
    }

    const resumen = await Venta.aggregate([
          { 
            $match: { 
              ...match,
              "FECHA ACTIVACION": { 
                $type: "string", 
                $ne: "", 
                $nin: ["N/A", "null", "0000-00-00"] 
              }
            }
          },
          { $addFields: { fechaAct: { $toDate: "$FECHA ACTIVACION" } } },
          { $match: { fechaAct: { $ne: null } } },
          {
            $group: {
              _id: {
                year: { $year: "$fechaAct" },
                month: { $month: "$fechaAct" }
              },
              totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } },
              totalQ: { $sum: { $toInt: "$Q" } }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': 1 } }
        ]);



    const formatted = resumen.map(r => ({
      year: r._id.year,
      month: r._id.month,
      totalCF: r.totalCF,
      totalQ: r.totalQ
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Error al obtener resumen de ventas:", err);
    res.status(500).json({ error: "Error al obtener resumen de ventas" });
  }
});

router.get("/productos-disponibles", async (req, res) => {
  try {
    const productos = await Venta.aggregate([
      {
        $match: {
          PRODUCTO: { $exists: true, $nin: [null, "", " ", "null", "N/A"] }
        }
      },
      {
        $group: {
          _id: {
            $trim: { input: "$TIPO_V" } // Quita espacios innecesarios
          }
        }
      },
      {
        $project: {
          _id: 0,
          producto: "$_id"
        }
      },
      {
        $sort: { producto: 1 }
      }
    ]);

    const productosUnicos = productos.map(p => p.producto);
    res.json(productosUnicos);
  } catch (error) {
    console.error("❌ Error al obtener productos disponibles:", error);
    res.status(500).json({ error: "Error al obtener productos disponibles" });
  }
});
// 4) Resumen agrupado por AÑO > MES > PRODUCTO con CF SIN y CON IGV

router.get("/productos", async (req, res) => {
  try {
    const { estadoFinal, año, meses, productos, conPDV, tipo } = req.query;

    const match = {
      "FECHA ACTIVACION": {
        $type: "string",
        $ne: "",
        $nin: ["N/A", "null", "0000-00-00"]
      },
      "TIPO_V": { $exists: true, $ne: "" }
    };

    if (estadoFinal) {
      match["ESTADO FINAL"] = estadoFinal;
    }

    if (productos) {
      const productosArray = productos.split(",").map(p => p.trim().toUpperCase());
      match["TIPO_V"] = { $in: productosArray };
    }

    if (tipo && tipo !== "Todos") {
      match["TIPO"] = tipo;
    }

    if (conPDV === "true") {
      match["PDV"] = { $exists: true, $nin: [null, "", " "] };
    }

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          fechaAct: { $toDate: "$FECHA ACTIVACION" }
        }
      }
    ];

    if (año && año !== "Todos") {
      pipeline.push({
        $match: {
          $expr: {
            $eq: [{ $year: "$fechaAct" }, parseInt(año)]
          }
        }
      });
    }

    if (meses) {
      const mesesArray = meses.split(",").map(m => parseInt(m));
      pipeline.push({
        $match: {
          $expr: {
            $in: [{ $month: "$fechaAct" }, mesesArray]
          }
        }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: {
            year: { $year: "$fechaAct" },
            month: { $month: "$fechaAct" },
            tipoVenta: "$TIPO_V",
            tipo: "$TIPO" 
          
          },
          totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } },
          totalCFConIGV: { $sum: { $toDouble: "$ CF CON IGV " } },
          totalQ: { $sum: { $toInt: "$Q" } }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": 1, "_id.tipoVenta": 1 }
      }
    );

    const resumen = await Venta.aggregate(pipeline);

    const resultado = resumen.map(item => ({
      year: item._id.year,
      month: item._id.month,
      producto: item._id.tipoVenta?.trim() || "N/A",
        tipo: item._id.tipo || "N/A", 
      totalCF: item.totalCF || 0,
      totalCFConIGV: item.totalCFConIGV || 0,
      Q: item.totalQ || 0
    }));

    res.json(resultado);
  } catch (err) {
    console.error("❌ Error en /ventas/productos:", err);
    res.status(500).json({ error: "Error al agrupar por tipo de venta" });
  }
});



router.get("/segmentos", async (req, res) => {
  try {
    const { año, mes, estadoFinal, producto, tipoV, pdv, conPDV } = req.query;

    // helpers
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(","));
    const clean = (arr) => arr.map(s => s?.toString().trim()).filter(Boolean);
    const toRegexExactI = (arr) => clean(arr).map(x => new RegExp(`^${esc(x)}$`, "i"));
    const isTrue = (v) => String(v).toLowerCase() === "true";

    // filtros flexibles
    const estadosRx = toRegexExactI(toArray(estadoFinal));
    // Backcompat: si te llega "producto", úsalo como TIPO_V; también soporta parámetro "tipoV"
    const tipoVParam = clean([...toArray(tipoV), ...toArray(producto)]).filter(v => !/^todos$/i.test(v));
    const tiposVRx  = toRegexExactI(tipoVParam);
    const pdvsRx    = toRegexExactI(toArray(pdv)).filter(r => r.source !== "^Todos$");

    // baseMatch (sin fecha aún)
    const andMatch = [
      { "SEGMENTO": { $exists: true, $nin: [null, "", " ", "null"] } },
      { "FECHA ACTIVACION": { $type: "string", $ne: "", $nin: ["N/A", "null", "0000-00-00"] } }
    ];
    if (estadosRx.length) andMatch.push({ "ESTADO FINAL": { $in: estadosRx } });
    if (tiposVRx.length)  andMatch.push({ "TIPO_V": { $in: tiposVRx } });
    if (isTrue(conPDV))   andMatch.push({ "PDV": { $exists: true, $nin: [null, "", " ", "null"] } });
    if (pdvsRx.length)    andMatch.push({ "PDV": { $in: pdvsRx } });

    const pipeline = [
      { $match: { $and: andMatch } },

      // convertir fecha con TZ Lima
      {
        $addFields: {
          fechaAct: {
            $dateFromString: {
              dateString: "$FECHA ACTIVACION",
              timezone: "America/Lima",
              onError: null,
              onNull: null
            }
          }
        }
      }
    ];

    // filtros por año / mes
    const expr = [];
    if (año) expr.push({ $eq: [{ $year: "$fechaAct" }, parseInt(año, 10)] });
    if (mes)  expr.push({ $eq: [{ $month: "$fechaAct" }, parseInt(mes, 10)] });
    if (expr.length) pipeline.push({ $match: { $expr: { $and: expr } } });

    // agrupar y proyectar
    pipeline.push(
      {
        $group: {
          _id: {
            $cond: [
              { $or: [ { $eq: ["$SEGMENTO", null] }, { $eq: ["$SEGMENTO", ""] } ] },
              "SIN INFORMACIÓN",
              { $trim: { input: { $toUpper: "$SEGMENTO" } } }
            ]
          },
          total: { $sum: 1 }
        }
      },
      {
        $project: { segmento: "$_id", total: 1, _id: 0 }
      },
      { $sort: { total: -1, segmento: 1 } }
    );

    const resultado = await Venta.aggregate(pipeline);
    res.json(resultado);
  } catch (error) {
    console.error("❌ Error en /ventas/segmentos:", error);
    res.status(500).json({ error: "Error al obtener datos por segmento" });
  }
});

router.get("/estados/conteo", async (req, res) => {
  try {
    const { año, mes, producto, tipoV, pdv, conPDV } = req.query;

    // Helpers
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(","));
    const clean = (arr) => arr.map(s => s?.toString().trim()).filter(Boolean);
    const toRegexExactI = (arr) => clean(arr).map(x => new RegExp(`^${esc(x)}$`, "i"));
    const isTrue = (v) => String(v).toLowerCase() === "true";

    // Filtros flexibles (producto/tipoV => TIPO_V)
    const tipoVParam = clean([...toArray(tipoV), ...toArray(producto)]).filter(v => !/^todos$/i.test(v));
    const tiposVRx = toRegexExactI(tipoVParam);
    const pdvsRx   = toRegexExactI(toArray(pdv)).filter(r => r.source !== "^Todos$");

    const pipeline = [
      // 1) Normalizaciones (NO filtramos por fecha ni estado aquí)
      {
        $addFields: {
          tipoVNorm:  { $trim: { input: "$TIPO_V" } },
          pdvNorm:    { $trim: { input: "$PDV" } },
          estadoNorm: { $trim: { input: "$ESTADO FINAL" } }
        }
      },

      // 2) Filtros por PDV / TIPO_V (no excluyen nada si no se envían)
      ...(isTrue(conPDV) ? [{ $match: { pdvNorm: { $nin: [null, "", " ", "null"] } } }] : []),
      ...(pdvsRx.length   ? [{ $match: { pdvNorm:   { $in: pdvsRx } } }] : []),
      ...(tiposVRx.length ? [{ $match: { tipoVNorm: { $in: tiposVRx } } }] : []),
    ];

    // 3) Filtros de tiempo SOLO si se piden (para no excluir nada cuando no hay año/mes)
    if (año || mes) {
      pipeline.push(
        {
          $addFields: {
            fechaAct: {
              $dateFromString: {
                dateString: "$FECHA ACTIVACION",
                timezone: "America/Lima",
                onError: null,
                onNull: null
              }
            }
          }
        },
        // si no se pudo convertir la fecha, no podemos evaluar año/mes -> se excluye SOLO en este modo
        { $match: { fechaAct: { $ne: null } } }
      );

      const expr = [];
      if (año) expr.push({ $eq: [{ $year: "$fechaAct" }, parseInt(año, 10)] });
      if (mes)  expr.push({ $eq: [{ $month: "$fechaAct" }, parseInt(mes, 10)] });
      if (expr.length) pipeline.push({ $match: { $expr: { $and: expr } } });
    }

    // 4) Agrupación (incluye vacíos como "SIN INFORMACIÓN")
    pipeline.push(
      {
        $group: {
          _id: {
            $cond: [
              { $or: [
                { $eq: ["$estadoNorm", null] },
                { $eq: ["$estadoNorm", ""] }
              ]},
              "SIN INFORMACIÓN",
              { $toUpper: "$estadoNorm" }
            ]
          },
          total: { $sum: 1 }
        }
      },
      { $project: { estado: "$_id", total: 1, _id: 0 } },
      { $sort: { total: -1, estado: 1 } }
    );

    const resultado = await Venta.aggregate(pipeline);
    res.json(resultado);
  } catch (err) {
    console.error("❌ Error al contar estados finales:", err);
    res.status(500).json({ error: "Error al contar estados finales" });
  }
});




router.get("/tipos-productos", async (req, res) => {
  try {
    const { año, mes, estadoFinal, producto, tipoV, pdv, conPDV } = req.query;

    // helpers
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(","));
    const clean = (arr) => arr.map(s => s?.toString().trim()).filter(Boolean);
    const toRegexExactI = (arr) => clean(arr).map(x => new RegExp(`^${esc(x)}$`, "i"));
    const isTrue = (v) => String(v).toLowerCase() === "true";

    // filtros flexibles
    const estadosRx = toRegexExactI(toArray(estadoFinal));

    // IMPORTANTE: interpretamos "producto" como filtro de TIPO_V (backcompat) y también aceptamos "tipoV"
    const tipoVParam = clean([...toArray(tipoV), ...toArray(producto)]).filter(v => !/^todos$/i.test(v));
    const tiposVRx  = toRegexExactI(tipoVParam);

    const pdvsRx    = toRegexExactI(toArray(pdv)).filter(r => r.source !== "^Todos$");

    // match base (sin fecha aún)
    const andMatch = [
      { "TIPO_V": { $exists: true, $nin: [null, "", " ", "null"] } },
      { "TIPO":   { $exists: true, $nin: [null, "", " ", "null"] } },
      { "FECHA ACTIVACION": { $type: "string", $ne: "", $nin: ["N/A", "null", "0000-00-00"] } }
    ];

    if (estadosRx.length) andMatch.push({ "ESTADO FINAL": { $in: estadosRx } });
    if (tiposVRx.length)  andMatch.push({ "TIPO_V": { $in: tiposVRx } });
    if (isTrue(conPDV))   andMatch.push({ "PDV": { $exists: true, $nin: [null, "", " ", "null"] } });
    if (pdvsRx.length)    andMatch.push({ "PDV": { $in: pdvsRx } });

    const pipeline = [
      { $match: { $and: andMatch } },

      // fecha robusta con TZ Lima
      {
        $addFields: {
          fechaAct: {
            $dateFromString: {
              dateString: "$FECHA ACTIVACION",
              timezone: "America/Lima",
              onError: null,
              onNull: null
            }
          }
        }
      }
    ];

    // filtros por año/mes (si llegan)
    const expr = [];
    if (año) expr.push({ $eq: [{ $year: "$fechaAct" }, parseInt(año, 10)] });
    if (mes)  expr.push({ $eq: [{ $month: "$fechaAct" }, parseInt(mes, 10)] });
    if (expr.length) pipeline.push({ $match: { $expr: { $and: expr } } });

    // agrupación
    pipeline.push(
      {
        $group: {
          _id: {
            tipo:     { $trim: { input: "$TIPO_V" } }, // TIPO_V
            producto: { $trim: { input: "$TIPO"   } }  // TIPO
          },
          total: { $sum: 1 }
        }
      },
      {
        $project: {
          tipo: "$_id.tipo",
          producto: "$_id.producto",
          total: 1,
          _id: 0
        }
      },
      { $sort: { total: -1, tipo: 1, producto: 1 } }
    );

    const resultado = await Venta.aggregate(pipeline);
    res.json(resultado);
  } catch (error) {
    console.error("❌ Error en /ventas/tipos-productos:", error);
    res.status(500).json({ error: "Error al agrupar por tipo y producto" });
  }
});


router.get("/pdv", async (req, res) => {
  try {
    const { año, meses, productos, estadoFinal, pdv, conPDV } = req.query;

    // -------- helpers --------
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(","));
    const clean = (arr) => arr.map(s => s?.toString().trim()).filter(Boolean);
    const toRegexExactI = (arr) => clean(arr).map(x => new RegExp(`^${esc(x)}$`, "i"));
    const isTrue = (v) => String(v).toLowerCase() === "true";

    // -------- parseo de filtros (flexibles) --------
    const estadosRx   = toRegexExactI(toArray(estadoFinal));
    // IMPORTANT: "productos" se interpreta como filtro de TIPO_V
    const tiposVRx    = toRegexExactI(toArray(productos)).filter(r => r.source !== "^Todos$");
    const pdvsRx      = toRegexExactI(toArray(pdv)).filter(r => r.source !== "^Todos$");

    const mesesNums = clean(toArray(meses))
      .map((m) => parseInt(m, 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);

    // -------- baseMatch (sin fecha aún) --------
    const andMatch = [
      { "FECHA ACTIVACION": { $type: "string", $ne: "", $nin: ["N/A", "null", "0000-00-00"] } }
    ];
    if (estadosRx.length) andMatch.push({ "ESTADO FINAL": { $in: estadosRx } });
    if (tiposVRx.length)  andMatch.push({ "TIPO_V": { $in: tiposVRx } });
    if (pdvsRx.length)    andMatch.push({ "PDV": { $in: pdvsRx } });

    // -------- pipeline base --------
    const basePipeline = [
      { $match: { $and: andMatch } },
      {
        $addFields: {
          // Conversión robusta con TZ Lima
          fechaAct: {
            $dateFromString: {
              dateString: "$FECHA ACTIVACION",
              timezone: "America/Lima",
              onError: null,
              onNull: null
            }
          }
        }
      }
    ];

    // filtros de tiempo
    const expr = [];
    if (año)      expr.push({ $eq: [{ $year: "$fechaAct" }, parseInt(año, 10)] });
    if (mesesNums.length) expr.push({ $in: [{ $month: "$fechaAct" }, mesesNums] });
    if (expr.length) basePipeline.push({ $match: { $expr: { $and: expr } } });

    // -------- facet: Con PDV vs Centralizado (Sin PDV) --------
    const pipeline = [
      ...basePipeline,
      {
        $facet: {
          conPDV: [
            { $match: { PDV: { $exists: true, $nin: [null, "", " ", "null"] } } },
            {
              $group: {
                _id: { $trim: { input: "$PDV" } },
                totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } },
                totalQ:  { $sum: { $toInt: "$Q" } }
              }
            },
            { $project: { pdv: "$_id", totalCF: 1, totalQ: 1, _id: 0 } },
            { $sort: { totalCF: -1 } }
          ],
          Centralizado: [
            {
              $match: {
                $or: [
                  { PDV: { $exists: false } },
                  { PDV: null },
                  { PDV: "" },
                  { PDV: " " },
                  { PDV: "null" }
                ]
              }
            },
            {
              $group: {
                _id: null,
                totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } },
                totalQ:  { $sum: { $toInt: "$Q" } }
              }
            },
            { $project: { _id: 0, totalCF: 1, totalQ: 1 } }
          ]
        }
      }
    ];

    const result = await Venta.aggregate(pipeline);

    const conPDVArray    = result[0]?.conPDV || [];
    const centralizado   = result[0]?.Centralizado?.[0] || { totalCF: 0, totalQ: 0 };

    // Totales para "Con PDV"
    const totalConPDV_Q  = conPDVArray.reduce((acc, cur) => acc + (cur.totalQ  || 0), 0);
    const totalConPDV_CF = conPDVArray.reduce((acc, cur) => acc + (cur.totalCF || 0), 0);

    // Totales para "Sin PDV"
    const totalSinPDV_Q  = centralizado.totalQ  || 0;
    const totalSinPDV_CF = centralizado.totalCF || 0;

    let respuesta = [];
    if (isTrue(conPDV)) {
      respuesta = [{ tipo: "Con PDV", totalQ: totalConPDV_Q, totalCF: totalConPDV_CF }];
    } else if (String(conPDV).toLowerCase() === "false") {
      respuesta = [{ tipo: "Sin PDV", totalQ: totalSinPDV_Q, totalCF: totalSinPDV_CF }];
    } else {
      respuesta = [
        { tipo: "Con PDV", totalQ: totalConPDV_Q, totalCF: totalConPDV_CF },
        { tipo: "Sin PDV", totalQ: totalSinPDV_Q, totalCF: totalSinPDV_CF }
      ];
    }

    res.json(respuesta);
  } catch (error) {
    console.error("❌ Error en /ventas/pdv:", error);
    res.status(500).json({ error: "Error al obtener datos por PDV" });
  }
});


router.get("/comparativa", async (req, res) => {
  try {
    const {
      tipo = "anual",     // "anual" | "mes" | "trimestre"
      mes,                // 1..12   (si tipo=mes)
      trimestre,          // 1..4    (si tipo=trimestre)
      año,                // ej. 2025
      meses,              // ej. "1,2,3" o [1,2,3]
      estadoFinal,        // "Aprobado" | "Aprobado,En Evaluación" | ["Aprobado","Rechazado"]
      productos,          // idem arriba
      pdv,                // "PDV X" o "PDV X,PDV Y" o ["PDV X","PDV Y"]
      conPDV,             // "true" para exigir PDV existente/no vacío
    } = req.query;

    // ---------- helpers ----------
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const toArray = (v) => {
      if (v == null) return [];
      if (Array.isArray(v)) return v;
      return String(v).split(",");
    };
    const clean = (arr) =>
      arr.map((s) => s?.toString().trim()).filter(Boolean);
    const toRegexExactI = (arr) => clean(arr).map((e) => new RegExp(`^${escapeRegExp(e)}$`, "i"));
    const isTrue = (v) => String(v).toLowerCase() === "true";

    // ---------- parseo de filtros ----------
    const estadosRegex   = toRegexExactI(toArray(estadoFinal));
const tiposVRegex = toRegexExactI(toArray(productos)).filter((r) => r.source !== "^Todos$"); // <--- ahora interpretamos 'productos' como filtro de TIPO_V
    const pdvsRegex      = toRegexExactI(toArray(pdv)).filter((r) => r.source !== "^Todos$");

    const mesesNums = clean(toArray(meses))
      .map((m) => parseInt(m, 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);

    const hoy = new Date();
    const añoActual = hoy.getFullYear();
    const añoPasado = añoActual - 1;

    // ---------- base matches ----------
   const baseMatch = {
  "FECHA ACTIVACION": { $type: "string", $ne: "", $nin: ["N/A", "null", "0000-00-00"] },
};
if (estadosRegex.length) baseMatch["ESTADO FINAL"] = { $in: estadosRegex };
if (tiposVRegex.length)  baseMatch["TIPO_V"]       = { $in: tiposVRegex }; // <--- cambio aquí
if (pdvsRegex.length)    baseMatch["PDV"]          = { $in: pdvsRegex };
if (isTrue(conPDV))      baseMatch["PDV"]          = { $exists: true, $nin: [null, "", " ", "null"] };

    // ---------- cálculo de rangos ----------
    let fechaInicioActual, fechaFinActual, fechaInicioPasado, fechaFinPasado;

    if (año) {
      // Si envías año (y opcionalmente meses), comparamos ese AÑO vs el AÑO-1;
      // y si hay "meses", comparamos esos meses específicos contra los mismos meses del año anterior.
      // Usaremos $expr con $year/$month para precisión.
    } else {
      // Fallback: lógica por tipo (anual/mes/trimestre) como ya tenías
      if (tipo === "mes" && mes) {
        fechaInicioActual = new Date(añoActual, mes - 1, 1);
        fechaFinActual    = new Date(añoActual, mes, 1);
        fechaInicioPasado = new Date(añoPasado, mes - 1, 1);
        fechaFinPasado    = new Date(añoPasado, mes, 1);
      } else if (tipo === "trimestre" && trimestre) {
        const startMonth  = (trimestre - 1) * 3;
        fechaInicioActual = new Date(añoActual, startMonth, 1);
        fechaFinActual    = new Date(añoActual, startMonth + 3, 1);
        fechaInicioPasado = new Date(añoPasado, startMonth, 1);
        fechaFinPasado    = new Date(añoPasado, startMonth + 3, 1);
      } else {
        // Anual hasta hoy (exclusivo mañana)
        fechaInicioActual = new Date(`${añoActual}-01-01`);
        fechaFinActual    = new Date(añoActual, hoy.getMonth(), hoy.getDate() + 1);
        fechaInicioPasado = new Date(`${añoPasado}-01-01`);
        fechaFinPasado    = new Date(añoPasado, hoy.getMonth(), hoy.getDate() + 1);
      }
    }

    // ---------- funciones de agregación ----------
    const aggPorRango = async (inicio, fin) => {
      return await Venta.aggregate([
        { $match: baseMatch },
        { $addFields: { fechaAct: { $toDate: "$FECHA ACTIVACION" } } },
        { $match: { fechaAct: { $gte: inicio, $lt: fin } } },
        {
          $group: {
            _id: null,
            totalQ:  { $sum: { $toInt: "$Q" } },
            totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } },
          },
        },
      ]);
    };

    const aggPorAñoMeses = async (year) => {
      const expr = [{ $eq: [{ $year: "$fechaAct" }, parseInt(year, 10)] }];
      if (mesesNums.length) {
        expr.push({ $in: [{ $month: "$fechaAct" }, mesesNums] });
      }
      return await Venta.aggregate([
        { $match: baseMatch },
        { $addFields: { fechaAct: { $toDate: "$FECHA ACTIVACION" } } },
        { $match: { $expr: { $and: expr } } },
        {
          $group: {
            _id: null,
            totalQ:  { $sum: { $toInt: "$Q" } },
            totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } },
          },
        },
      ]);
    };

    // ---------- ejecutar comparativa ----------
    let dataActual = [], dataPasado = [];

    if (año) {
      dataActual = await aggPorAñoMeses(año);
      dataPasado = await aggPorAñoMeses(parseInt(año, 10) - 1);
    } else {
      dataActual = await aggPorRango(fechaInicioActual, fechaFinActual);
      dataPasado = await aggPorRango(fechaInicioPasado, fechaFinPasado);
    }

    const actual = dataActual[0] || { totalQ: 0, totalCF: 0 };
    const pasado = dataPasado[0] || { totalQ: 0, totalCF: 0 };

    const variacion = (a, p) => (p === 0 ? 0 : ((a - p) / p) * 100);

    const comparativa = [
      { name: "Q",  actual: actual.totalQ,  pasado: pasado.totalQ,  variacion: variacion(actual.totalQ,  pasado.totalQ)  },
      { name: "CF", actual: actual.totalCF, pasado: pasado.totalCF, variacion: variacion(actual.totalCF, pasado.totalCF) },
    ];

    res.json({
      tipo,
      filtros: {
  año: año ? parseInt(año, 10) : null,
  meses: mesesNums,
  estadoFinal: estadosRegex.map((r) => r.source.replace(/^\^|\$$/g, "")),
  tipoV: tiposVRegex.map((r) => r.source.replace(/^\^|\$$/g, "")), // en vez de productos
  pdv: pdvsRegex.map((r) => r.source.replace(/^\^|\$$/g, "")),
  conPDV: isTrue(conPDV),
}
,
      rangoActual:  año ? null : { inicio: fechaInicioActual,  fin: fechaFinActual  },
      rangoPasado:  año ? null : { inicio: fechaInicioPasado,  fin: fechaFinPasado  },
      comparativa,
    });
  } catch (error) {
    console.error("❌ Error en /ventas/comparativa:", error);
    res.status(500).json({ message: "Error al obtener la comparativa de ventas" });
  }
});


router.get("/mes-vs-ytd", async (req, res) => {
  try {
    const {
      año,
      mes,
      estadoFinal,   // "Aprobado" | "Aprobado,En Evaluación" | ["Aprobado","Rechazado"]
      productos,     // "Internet Dedicado" | "Internet Dedicado,Telefonía Fija" | [...]
      pdv,           // "PDV X" | "PDV X,PDV Y" | [...]
      conPDV         // "true" para exigir PDV no vacío
    } = req.query;

    // ---------- helpers ----------
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(","));
    const clean = (arr) => arr.map(s => s?.toString().trim()).filter(Boolean);
    const toRegexExactI = (arr) => clean(arr).map(x => new RegExp(`^${escapeRegExp(x)}$`, "i"));
    const isTrue = (v) => String(v).toLowerCase() === "true";

    // ---------- parseo de filtros ----------
    const estadosRegex   = toRegexExactI(toArray(estadoFinal));
    const productosRegex = toRegexExactI(toArray(productos)).filter(r => r.source !== "^Todos$");
    const pdvsRegex      = toRegexExactI(toArray(pdv)).filter(r => r.source !== "^Todos$");

    const hoy   = new Date();
    const year  = año ? parseInt(año, 10) : hoy.getFullYear();
    const month = mes ? parseInt(mes, 10) : (hoy.getMonth() + 1);

    // --- Fechas con corte local Lima ---
    // Mes completo del mes seleccionado: [monthStart, monthEnd)
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd   = new Date(year, month,     1, 0, 0, 0, 0);

    // YTD: del 1/ene al (hoy + 1 día) del año elegido, exclusivo
    const corteMes = hoy.getMonth();     // 0..11
    const corteDia = hoy.getDate() + 1;  // exclusivo
    const ytdStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const ytdEnd   = new Date(year, corteMes, corteDia, 0, 0, 0, 0);

    // --- Match base + filtros dinámicos (sin fecha) ---
    const andMatch = [
      {
        "FECHA ACTIVACION": {
          $type: "string",
          $ne: "",
          $nin: ["N/A", "null", "0000-00-00"]
        }
      }
    ];

    if (isTrue(conPDV)) {
      andMatch.push({ "PDV": { $exists: true, $nin: [null, "", " ", "null"] } });
    }
    if (pdvsRegex.length) {
      andMatch.push({ "PDV": { $in: pdvsRegex } });
    }
    if (productosRegex.length) {
      andMatch.push({ "PRODUCTO": { $in: productosRegex } });
    }
    if (estadosRegex.length) {
      andMatch.push({ "ESTADO FINAL": { $in: estadosRegex } });
    }

    const resultado = await Venta.aggregate([
      { $match: { $and: andMatch } },

      // Convertimos STRING -> DATE con TZ Lima para evitar desfases
      {
        $addFields: {
          fechaAct: {
            $dateFromString: {
              dateString: "$FECHA ACTIVACION",
              timezone: "America/Lima",
              onError: null,
              onNull: null
            }
          }
        }
      },

      // Cada rama aplica su propio rango
      {
        $facet: {
          mes: [
            { $match: { fechaAct: { $gte: monthStart, $lt: monthEnd } } },
            {
              $group: {
                _id: null,
                totalQ:  { $sum: { $toInt: "$Q" } },
                // ⚠️ Asegura el nombre del campo exactamente como está en tu colección
                totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } }
              }
            }
          ],
          ytd: [
            { $match: { fechaAct: { $gte: ytdStart, $lt: ytdEnd } } },
            {
              $group: {
                _id: null,
                totalQ:  { $sum: { $toInt: "$Q" } },
                totalCF: { $sum: { $toDouble: "$ CF SIN IGV " } }
              }
            }
          ]
        }
      }
    ]);

    const facet   = resultado[0] || { mes: [], ytd: [] };
    const mesData = facet.mes[0] || { totalQ: 0, totalCF: 0 };
    const ytdData = facet.ytd[0] || { totalQ: 0, totalCF: 0 };

    res.json({
      meta: {
        year,
        month,
        filtros: {
          estadoFinal: estadosRegex.map(r => r.source.replace(/^\^|\$$/g, "")),
          productos:   productosRegex.map(r => r.source.replace(/^\^|\$$/g, "")),
          pdv:         pdvsRegex.map(r => r.source.replace(/^\^|\$$/g, "")),
          conPDV: isTrue(conPDV)
        },
        monthStartISO: monthStart.toISOString(),
        monthEndISO:   monthEnd.toISOString(),
        ytdStartISO:   ytdStart.toISOString(),
        ytdEndISO:     ytdEnd.toISOString()
      },
      mes: { Q: mesData.totalQ, CF: mesData.totalCF },
      ytd: { Q: ytdData.totalQ, CF: ytdData.totalCF },
      chart: [
        { name: "Q",  Mes: mesData.totalQ,  "Acumulado YTD": ytdData.totalQ,  tipo: "Q"  },
        { name: "CF", Mes: mesData.totalCF, "Acumulado YTD": ytdData.totalCF, tipo: "CF" }
      ]
    });
  } catch (error) {
    console.error("❌ Error en /ventas/mes-vs-ytd:", error);
    res.status(500).json({ message: "Error al obtener Mes vs YTD" });
  }
});



export default router;