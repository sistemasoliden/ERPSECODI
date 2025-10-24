import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ExecMultiSelect({ members = [], value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const anchorRef = useRef(null);
  const panelRef = useRef(null);

  // --- cálculo de posición (usamos portal con position:fixed)
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 300,
    dropUp: false,
  });

  const recalc = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;

    const PANEL_MAX_H = 260; // límite de alto del dropdown
    const GAP = 8;

    const spaceBelow = viewportH - r.bottom;
    const spaceAbove = r.top;
    const dropUp = spaceBelow < PANEL_MAX_H && spaceAbove > spaceBelow;

    const top = dropUp ? Math.max(8, r.top - PANEL_MAX_H - GAP) : Math.min(viewportH - 8, r.bottom + GAP);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8));
    const width = Math.max(r.width, 300);

    
    setPos({ top, left, width, dropUp });
  };

  useLayoutEffect(() => {
    if (open) recalc();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => recalc();
    const onResize = () => recalc();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // --- cerrar al click afuera (considera portal)
  useEffect(() => {
    const onDoc = (e) => {
      const a = anchorRef.current;
      const p = panelRef.current;
      if (!a || !p) return;
      if (a.contains(e.target) || p.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // --- normalizaciones / memos
  const allIds = useMemo(() => members.map((m) => String(m._id)), [members]);
  const selectedSet = useMemo(() => new Set(value.map(String)), [value]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return members;
    return members.filter((m) => (m.name || "").toLowerCase().includes(f));
  }, [members, filter]);

  const filteredIds = useMemo(() => filtered.map((m) => String(m._id)), [filtered]);

  // limpia ids ya inexistentes si cambian los members
  useEffect(() => {
    if (!onChange) return;
    const allowed = new Set(allIds);
    const cleaned = value.map(String).filter((id) => allowed.has(id));
    if (cleaned.length !== value.length) onChange(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds.join(",")]);

  const toggleOne = (id) => {
    const next = new Set(selectedSet);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange?.(Array.from(next));
  };

  // “Todos” respeta filtro si hay texto, o selecciona todo el equipo si no hay filtro
  const selectAll = () => {
    const target = filter ? filteredIds : allIds;
    onChange?.(Array.from(new Set([...target])));
  };

  // “Ninguno”: si hay filtro, desmarca solo lo filtrado; si no, limpia todo
  const selectNone = () => {
    if (!filter) {
      onChange?.([]);
      return;
    }
    const toRemove = new Set(filteredIds);
    const keep = Array.from(selectedSet).filter((id) => !toRemove.has(id));
    onChange?.(keep);
  };

  // etiqueta del botón
  const label = useMemo(() => {
    if (value.length === 0) return "Sin selección";
    if (value.length === allIds.length && allIds.length > 0) return "Todos";
    const mapById = new Map(members.map((m) => [String(m._id), m.name]));
    const picked = value.slice(0, 2).map((id) => mapById.get(String(id)) || "—");
    return value.length <= 2 ? picked.join(", ") : `${value.length} seleccionados`;
  }, [value, allIds.length, members]);

  return (
    <>
      <div ref={anchorRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-12 min-w-56 inline-flex items-center justify-between rounded-lg border border-gray-900 bg-white px-3 text-[12px]"
          title="Selecciona uno o varios ejecutivos"
        >
          <span className="truncate pr-2">{label}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className="rounded-lg border border-gray-300 bg-white shadow-xl"
          >
            {/* Filtro */}
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar ejecutivos…"
                className="w-full rounded-md border border-gray-300 px-2 py-2 text-[12px]"
              />
            </div>

            {/* Acciones */}
            <div className="p-2 flex items-center justify-between gap-2 border-b border-gray-200">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] rounded border border-gray-300 px-2 py-1 bg-white hover:bg-gray-50"
                title={filter ? "Seleccionar todos (filtrados)" : "Seleccionar todos"}
              >
                {filter ? "Todos (filtro)" : "Todos"}
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-[11px] rounded border border-gray-300 px-2 py-1 bg-white hover:bg-gray-50"
                title={filter ? "Quitar selección (filtrados)" : "Quitar selección (todos)"}
              >
                Ninguno
              </button>
            </div>

            {/* Lista */}
            <div className="py-1 max-h-[260px] overflow-auto">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-gray-500">Sin resultados</div>
              )}
              {filtered.map((m) => {
                const id = String(m._id);
                const checked = selectedSet.has(id);
                return (
                  <label key={id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(id)}
                      className="h-3 w-3 rounded border-gray-400"
                    />
                    <span className="truncate">{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
