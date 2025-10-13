// StagePathChevrons.jsx
import React, { useMemo } from "react";

const STAGE_ORDER = [
  { _id: "68b859269d14cf7b7e510848", nombre: "Propuesta identificada" },
  { _id: "68b859269d14cf7b7e510849", nombre: "Propuesta calificada" },
  { _id: "68b859269d14cf7b7e51084a", nombre: "Propuesta entregada" },
  { _id: "68b859269d14cf7b7e51084b", nombre: "Negociación" },
  { _id: "68b859269d14cf7b7e51084c", nombre: "Negociación aprobada" },
  { _id: "68b859269d14cf7b7e51084d", nombre: "Propuesta cerrada ganada" },
  { _id: "68b859269d14cf7b7e51084e", nombre: "Propuesta cerrada perdida" },
];

const BASE_GRADIENT = ["#4dccefff", "#165982ff"]; // sky-500 → sky-700

function chevronPath(x, w, h, d) {
  const mid = h / 2;
  return [
    `M ${x},0`,
    `H ${x + w - d}`,
    `L ${x + w},${mid}`,
    `L ${x + w - d},${h}`,
    `H ${x}`,
    `L ${x + d},${mid}`,
    "Z",
  ].join(" ");
}

// Divide un texto en 2 líneas robustamente
function splitIntoTwoLines(text) {
  // 1) Normaliza y reemplaza espacios "raros" por espacio normal
  const clean = String(text || "")
    .normalize("NFC")
    .replace(/[\u00A0\u202F]/g, " ") // NBSP y narrow NBSP → espacio normal
    .replace(/\s+/g, " ") // colapsa espacios
    .trim();

  const words = clean.split(" ");
  if (words.length <= 1) return [clean, ""];

  // 2) Si hay exactamente 2 palabras, fuerza 1/1
  if (words.length === 2) {
    return [words[0], words[1]];
  }

  // 3) Balanceo aproximado para 3+ palabras
  const totalLen = clean.length;
  const target = Math.ceil(totalLen / 2);

  let line1 = [];
  let len1 = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const extra = (line1.length ? 1 : 0) + w.length; // +1 por el espacio
    if (len1 + extra <= target) {
      line1.push(w);
      len1 += extra;
    } else {
      const line2 = words.slice(i).join(" ");
      return [line1.join(" "), line2];
    }
  }
  return [line1.join(" "), ""]; // fallback
}

export default function StagePathChevrons({ currentId, onChange, tipos = [] }) {
  const ordered = useMemo(() => {
    const map = new Map((tipos || []).map((t) => [t._id, t]));
    return STAGE_ORDER.map((s) => map.get(s._id) || s);
  }, [tipos]);

  const n = ordered.length;
  const currentIdx = Math.max(
    0,
    ordered.findIndex((s) => s._id === currentId)
  );

  // === Tamaño fijo por chevron (px) + separación (px)
  const H = 70; // alto
  const PIECE_W = 150; // ancho fijo por chevron
  const GAP = 6; // separación entre chevrons
  const notch = Math.min(22, PIECE_W * 0.22); // muesca
  const overlap = notch; // solape para cubrir la muesca

  // arriba del return (o al inicio del componente), define tamaños:
  const FONT_SIZE = 12; // ≈ "text-xl"
  const FONT_WEIGHT = 600;

  // Ancho total: n*PIECE_W - (n-1)*overlap + (n-1)*GAP
  const TOTAL_W = n * PIECE_W - (n - 1) * overlap + (n - 1) * GAP;

  return (
    <div className="w-full select-none overflow-x-auto">
      <svg
        viewBox={`0 0 ${TOTAL_W} ${H}`}
        width="100%"
        height={H}
        aria-hidden
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="g-unico" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={BASE_GRADIENT[0]} />
            <stop offset="100%" stopColor={BASE_GRADIENT[1]} />
          </linearGradient>
        </defs>

        {ordered.map((s, i) => {
          const x = i * (PIECE_W - overlap + GAP);
          const d = chevronPath(x, PIECE_W, H, notch);
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx;
          const [line1, line2] = splitIntoTwoLines(s.nombre);

          return (
            <g
              key={s._id}
              onClick={() => onChange?.(s._id)}
              style={{ cursor: "pointer" }}
            >
              {/* Fondo */}
              <path d={d} fill="url(#g-unico)" opacity={isDone ? 0.95 : 1} />

              {/* Texto */}
              {/* Texto centrado (H/V), grande y bold */}
              <text
                x={x + PIECE_W / 2}
                y={H / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={FONT_SIZE}
                fontWeight={FONT_WEIGHT}
                fill="#fff"
                style={{
                  filter: isCurrent
                    ? "drop-shadow(0 1px 1px rgba(0,0,0,.35))"
                    : "none",
                }}
              >
                {line2 ? (
                  <>
                    {/* Si hay 2 líneas: sube la primera un poco y baja la segunda, 
          quedando el “promedio” justo en el centro vertical */}
                    <tspan x={x + PIECE_W / 2} dy="-0.35em">
                      {line1}
                    </tspan>
                    <tspan x={x + PIECE_W / 2} dy="1.2em">
                      {line2}
                    </tspan>
                  </>
                ) : (
                  // Si solo hay una línea, se mantiene exactamente centrada
                  <tspan x={x + PIECE_W / 2} dy="0">
                    {line1}
                  </tspan>
                )}
              </text>

              {/* Resaltado del actual (invisible, por si quieres activarlo luego) */}
              {isCurrent && (
                <rect
                  x={x + 5}
                  y={5}
                  width={PIECE_W - 10}
                  height={H - 10}
                  rx="7"
                  ry="7"
                  fill="none"
                  stroke="rgba(255,255,255,0)"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
