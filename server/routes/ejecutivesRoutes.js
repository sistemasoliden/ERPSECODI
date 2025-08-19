import express from "express";
import Venta from "../models/Venta.js";

const router = express.Router();

// Ruta: GET /api/ejecutivos/consultores
router.get("/consultores", async (req, res) => {
  try {
    const { año, mes, estadoFinal, producto, conPDV, consultor } = req.query;

    const match = {
      CONSULTORES: { $exists: true, $nin: [null, "", " ", "null"] },
      "FECHA ACTIVACION": {
        $type: "string",
        $ne: "",
        $nin: ["N/A", "null", "0000-00-00"],
      },
    };

    if (estadoFinal) match["ESTADO FINAL"] = estadoFinal;
    if (producto && producto !== "Todos") match["TIPO_V"] = producto; // igual que en consultorestabla
    if (conPDV === "true") {
      match["PDV"] = { $exists: true, $nin: [null, "", " ", "null"] };
    }

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          fechaAct: { $toDate: "$FECHA ACTIVACION" },
          consultorNormalizado: {
            $trim: { input: { $toUpper: "$CONSULTORES" } },
          },
        },
      },
    ];

    if (año) {
      pipeline.push({
        $match: { $expr: { $eq: [{ $year: "$fechaAct" }, parseInt(año)] } },
      });
    }

    if (mes) {
      pipeline.push({
        $match: { $expr: { $eq: [{ $month: "$fechaAct" }, parseInt(mes)] } },
      });
    }

    if (consultor && consultor.trim() !== "") {
      const lista = Array.isArray(consultor)
        ? consultor
        : consultor
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean);

      pipeline.push({
        $match:
          lista.length === 1
            ? { consultorNormalizado: lista[0] }
            : { consultorNormalizado: { $in: lista } },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$consultorNormalizado",
          totalQ: { $sum: { $toInt: { $ifNull: ["$Q", 0] } } },
          totalCF: {
            $sum: { $toDouble: { $ifNull: ["$ CF SIN IGV ", 0] } },
          },
        },
      },
      {
        $project: {
          consultor: "$_id",
          totalQ: 1,
          totalCF: 1,
          _id: 0,
        },
      },
      { $sort: { totalQ: -1 } }
    );

    const resultado = await Venta.aggregate(pipeline);
    res.json(resultado);
  } catch (err) {
    console.error("❌ Error en /ejecutivos/consultores:", err);
    res.status(500).json({ error: "Error al obtener datos de consultores" });
  }
});


router.get("/consultorestabla", async (req, res) => {
  try {
    const { año, mes, estadoFinal, producto, conPDV, consultor } = req.query;

    const match = {
      CONSULTORES: { $exists: true, $nin: [null, "", " ", "null"] },
      "FECHA ACTIVACION": {
        $type: "string",
        $ne: "",
        $nin: ["N/A", "null", "0000-00-00"],
      },
    };

    if (estadoFinal) match["ESTADO FINAL"] = estadoFinal;
    if (producto && producto !== "Todos") match["TIPO_V"] = producto; // ahora filtramos por TIPO_V
    if (conPDV === "true")
      match["PDV"] = { $exists: true, $nin: [null, "", " ", "null"] };

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          fechaAct: { $toDate: "$FECHA ACTIVACION" },
          consultorNormalizado: {
            $trim: { input: { $toUpper: "$CONSULTORES" } },
          },
        },
      },
    ];

    if (año) {
      pipeline.push({
        $match: {
          $expr: { $eq: [{ $year: "$fechaAct" }, parseInt(año)] },
        },
      });
    }

    if (req.query.meses) {
      const mesesArray = Array.isArray(req.query.meses)
        ? req.query.meses.map(Number)
        : [Number(req.query.meses)];

      pipeline.push({
        $match: {
          $expr: { $in: [{ $month: "$fechaAct" }, mesesArray] },
        },
      });
    }

    if (consultor && consultor.trim() !== "") {
      const lista = Array.isArray(consultor)
        ? consultor
        : consultor
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean);

      pipeline.push({
        $match:
          lista.length === 1
            ? { consultorNormalizado: lista[0] }
            : { consultorNormalizado: { $in: lista } },
      });
    }

    pipeline.push(
      {
        $facet: {
          ventasAgrupadas: [
            {
              $group: {
                _id: {
                  año: { $year: "$fechaAct" },
                  mes: { $month: "$fechaAct" },
                  consultor: "$consultorNormalizado",
                  tipoV: "$TIPO_V", // ahora agrupamos por TIPO_V
                },
                totalQ: { $sum: { $toInt: { $ifNull: ["$Q", 0] } } },
                totalCF: {
                  $sum: { $toDouble: { $ifNull: ["$ CF SIN IGV ", 0] } },
                },
              },
            },
            {
              $project: {
                year: "$_id.año",
                month: "$_id.mes",
                consultor: "$_id.consultor",
                tipoV: "$_id.tipoV", // cambiamos el nombre
                totalQ: 1,
                totalCF: 1,
                _id: 0,
              },
            },
          ],
          todosLosTipos: [
            // ahora se llama todosLosTipos
            {
              $group: {
                _id: "$TIPO_V",
              },
            },
            {
              $project: {
                tipoV: "$_id",
                _id: 0,
              },
            },
          ],
        },
      },
      {
        $unwind: "$ventasAgrupadas",
      },
      {
        $group: {
          _id: {
            year: "$ventasAgrupadas.year",
            month: "$ventasAgrupadas.month",
            consultor: "$ventasAgrupadas.consultor",
          },
          tipos: { $push: "$ventasAgrupadas" },
          todosLosTipos: { $first: "$todosLosTipos" },
        },
      },
      {
        $project: {
          year: "$_id.year",
          month: "$_id.month",
          consultor: "$_id.consultor",
          tipos: {
            $map: {
              input: "$todosLosTipos",
              as: "t",
              in: {
                $let: {
                  vars: {
                    encontrado: {
                      $first: {
                        $filter: {
                          input: "$tipos",
                          as: "vt",
                          cond: { $eq: ["$$vt.tipoV", "$$t.tipoV"] },
                        },
                      },
                    },
                  },
                  in: {
                    tipoV: "$$t.tipoV",
                    totalQ: { $ifNull: ["$$encontrado.totalQ", 0] },
                    totalCF: { $ifNull: ["$$encontrado.totalCF", 0] },
                  },
                },
              },
            },
          },
        },
      },
      { $unwind: "$tipos" },
      {
        $project: {
          year: 1,
          month: 1,
          consultor: 1,
          tipoV: "$tipos.tipoV",
          totalQ: "$tipos.totalQ",
          totalCF: "$tipos.totalCF",
        },
      },
      { $sort: { year: -1, month: -1, consultor: 1, tipoV: 1 } }
    );

    const resultado = await Venta.aggregate(pipeline);
    res.json(resultado);
  } catch (err) {
    console.error("❌ Error en /ejecutivos/consultorestabla:", err);
    res.status(500).json({ error: "Error al obtener datos de consultores" });
  }
});

router.get("/consultores-disponibles", async (req, res) => {
  try {
    const { año, meses, estadoFinal, producto, conPDV } = req.query;

    const match = {
      CONSULTORES: { $exists: true, $nin: [null, "", " ", "null"] },
      "FECHA ACTIVACION": {
        $type: "string",
        $ne: "",
        $nin: ["N/A", "null", "0000-00-00"],
      },
    };

    if (estadoFinal) match["ESTADO FINAL"] = estadoFinal;
    if (producto && producto !== "Todos") match["PRODUCTO"] = producto;
    if (conPDV === "true")
      match["PDV"] = { $exists: true, $nin: [null, "", " ", "null"] };

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          fechaAct: { $toDate: "$FECHA ACTIVACION" },
          consultorNormalizado: {
            $trim: { input: { $toUpper: "$CONSULTORES" } },
          },
        },
      },
    ];

    if (año) {
      pipeline.push({
        $match: {
          $expr: { $eq: [{ $year: "$fechaAct" }, parseInt(año)] },
        },
      });
    }

    if (meses) {
      const mesesArray = Array.isArray(meses)
        ? meses.map(Number)
        : meses.split(",").map((m) => parseInt(m));
      pipeline.push({
        $match: {
          $expr: { $in: [{ $month: "$fechaAct" }, mesesArray] },
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$consultorNormalizado",
        },
      },
      {
        $project: {
          _id: 0,
          consultor: "$_id",
        },
      },
      { $sort: { consultor: 1 } }
    );

    const resultado = await Venta.aggregate(pipeline);
    const consultoresUnicos = resultado.map((r) => r.consultor);

    res.json(consultoresUnicos);
  } catch (err) {
    console.error("❌ Error en /consultores-disponibles:", err);
    res.status(500).json({ error: "Error al obtener consultores disponibles" });
  }
});

export default router;
