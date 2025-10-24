// StagePathChevrons.jsx
import React, { useMemo } from "react";

const STAGE_ORDER = [
  { _id: "68b859269d14cf7b7e510848", nombre: "Propuesta identificada" },
  { _id: "68b859269d14cf7b7e51084a", nombre: "Propuesta entregada" },
  { _id: "68b859269d14cf7b7e51084b", nombre: "Negociación" },
  { _id: "68b859269d14cf7b7e51084c", nombre: "Negociación aprobada" },
  { _id: "68b859269d14cf7b7e51084d", nombre: "Propuesta cerrada ganada" },
  { _id: "68b859269d14cf7b7e51084e", nombre: "Propuesta cerrada perdida" },
];

// Genera el path del chevron
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

// Divide texto en dos líneas
function splitIntoTwoLines(text) {
  const clean = String(text || "")
    .normalize("NFC")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = clean.split(" ");
  if (words.length <= 1) return [clean, ""];
  if (words.length === 2) return [words[0], words[1]];

  const totalLen = clean.length;
  const target = Math.ceil(totalLen / 2);
  const line1 = [];
  let len1 = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const extra = (line1.length ? 1 : 0) + w.length;
    if (len1 + extra <= target) {
      line1.push(w);
      len1 += extra;
    } else {
      return [line1.join(" "), words.slice(i).join(" ")];
    }
  }
  return [line1.join(" "), ""];
}

/**
 * Props opcionales de colores:
 * - defaultGradient: [from, to]
 * - currentGradient: [from, to]
 * - doneGradient: [from, to]
 * - dimDone (boolean): baja opacidad a los hechos
 */
export default function StagePathChevrons({
  currentId,
  onChange,
  tipos = [],
  defaultGradient = ["#4DCCEF", "#165982"], // celeste → azul
  currentGradient = ["#7C3AED", "#4C1D95"], // violeta (indigo-500→900)
  doneGradient = ["#10B981", "#047857"], // verde (emerald-500→700)
  dimDone = false,
}) {
  const ordered = useMemo(() => {
    const map = new Map((tipos || []).map((t) => [t._id, t]));
    return STAGE_ORDER.map((s) => map.get(s._id) || s);
  }, [tipos]);

  const n = ordered.length;
  const currentIdx = Math.max(
    0,
    ordered.findIndex((s) => s._id === currentId)
  );

  // Tamaños
  const H = 70;
  const PIECE_W = 150;
  const GAP = 6;
  const notch = Math.min(22, PIECE_W * 0.22);
  const FONT_SIZE = 12;
  const FONT_WEIGHT = 600;

  const overlap = notch;
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
        {/* Gradientes */}
        <defs>
          <linearGradient id="g-default" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={defaultGradient[0]} />
            <stop offset="100%" stopColor={defaultGradient[1]} />
          </linearGradient>

          <linearGradient id="g-current" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={currentGradient[0]} />
            <stop offset="100%" stopColor={currentGradient[1]} />
          </linearGradient>

          <linearGradient id="g-done" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={doneGradient[0]} />
            <stop offset="100%" stopColor={doneGradient[1]} />
          </linearGradient>
        </defs>

        {ordered.map((s, i) => {
          const x = i * (PIECE_W - overlap + GAP);
          const d = chevronPath(x, PIECE_W, H, notch);
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx;
          const [line1, line2] = splitIntoTwoLines(s.nombre);

          // Selección de color
          const fillId = isCurrent
            ? "g-current"
            : isDone
            ? "g-done"
            : "g-default";
          const opacity = isDone && dimDone ? 0.9 : 1;

          return (
            <g
              key={s._id}
              onClick={() => onChange?.(s._id)}
              style={{ cursor: "pointer" }}
            >
              <path d={d} fill={`url(#${fillId})`} opacity={opacity} />

              {/* Texto centrado */}
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
                    <tspan x={x + PIECE_W / 2} dy="-0.35em">
                      {line1}
                    </tspan>
                    <tspan x={x + PIECE_W / 2} dy="1.2em">
                      {line2}
                    </tspan>
                  </>
                ) : (
                  <tspan x={x + PIECE_W / 2} dy="0">
                    {line1}
                  </tspan>
                )}
              </text>

              {/* Borde sutil en el actual (opcional) */}
              {isCurrent && (
                <rect
                  x={x + 5}
                  y={5}
                  width={PIECE_W - 10}
                  height={H - 10}
                  rx="7"
                  ry="7"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
