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

/** Paleta fija por etapa (chevrons con gradiente) */
const COLORS = [
  "from-sky-500 to-sky-600",
  "from-lime-500 to-lime-600",
  "from-orange-500 to-orange-600",
  "from-violet-500 to-violet-600",
  "from-pink-500 to-pink-600",
  "from-emerald-500 to-emerald-600",
  "from-red-500 to-red-600",
];

export default function StagePath({ currentId, onChange, tipos = [] }) {
  // Respeta SIEMPRE el orden por _id_, pero usa nombres del backend si difieren
  const ordered = useMemo(() => {
    const map = new Map((tipos || []).map(t => [t._id, t]));
    return STAGE_ORDER.map(s => map.get(s._id) || s);
  }, [tipos]);

  const currentIdx = Math.max(0, ordered.findIndex(s => s._id === currentId));

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-full gap-1">
        {ordered.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isDone = i < currentIdx;
          const color = COLORS[i] || "from-gray-400 to-gray-500";

          return (
            <button
              key={s._id}
              type="button"
              onClick={() => onChange?.(s._id)}
              className={[
                "relative h-12 min-w-[170px] flex-1 px-4 text-left text-white font-medium",
                "bg-gradient-to-b shadow-sm transition",
                isDone ? "opacity-85" : "",
                !isCurrent ? "saturate-90" : "ring-2 ring-black/10 scale-[1.01]",
              ].join(" ")}
              style={{
                // chevron con clip-path
                clipPath:
                  "polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%)",
              }}
            >
              {/* superponer el gradiente específico */}
              <div className={`absolute inset-0 rounded-sm bg-gradient-to-b ${color}`} />
              {/* etiqueta */}
              <div className="relative z-10 flex h-full items-center">
                <span className={`text-[12px] leading-4 ${isCurrent ? "drop-shadow-[0_1px_1px_rgba(0,0,0,.35)]" : ""}`}>
                  {s.nombre}
                </span>
              </div>

              {/* badge “actual” arriba */}
              {isCurrent && (
                <span className="absolute -top-2 left-3 z-10 rounded-full bg-black/80 px-2 py-0.5 text-[10px] text-white">
                  etapa actual
                </span>
              )}

              {/* Solape para que encaje con la siguiente */}
              {i > 0 && (
                <div
                  className="absolute -left-1 top-0 h-full w-1 bg-white/80"
                  style={{
                    clipPath:
                      "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 50%)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
