// src/pages/AsignarRucs.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const COMMERCIAL_ROLE_ID = "68a4f22d27e6abe98157a831";

export default function AsignarRucs() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");

  const [rawRucs, setRawRucs] = useState("");
  const [allowReassign, setAllowReassign] = useState(false);
  const [note, setNote] = useState("");

  const [preview, setPreview] = useState(null);
  const [assignResult, setAssignResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Carga usuarios activos y filtra solo "Comercial"
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/activos", authHeader);
        const onlyCommercial = (data || []).filter((u) => {
          const roleId = String(u?.role?._id ?? u?.role ?? "");
          return roleId === COMMERCIAL_ROLE_ID;
        });
        setUsers(onlyCommercial);
      } catch (e) {
        console.error(e);
        setError("Error cargando ejecutivos.");
      }
    })();
  }, [authHeader]);

  // Normaliza RUCs
  const parseRucs = (text) =>
    Array.from(
      new Set(
        String(text || "")
          .split(/[\s,;\n]+/)
          .map((r) => r.replace(/\D/g, ""))
          .filter((r) => /^\d{11}$/.test(r))
      )
    );

  // Previsualizar
  const handlePreview = async () => {
    const rucs = parseRucs(rawRucs);
    if (!rucs.length) {
      setError("Debes ingresar al menos un RUC válido (11 dígitos).");
      return;
    }
    setLoading(true);
    setError("");
    setAssignResult(null);
    try {
      const { data } = await api.post("/basesecodi/by-rucs", { rucs }, authHeader);
      setPreview(data || { found: [], missing: [], conflicted: [] });
    } catch (e) {
      console.error(e);
      setError("Error al previsualizar RUCs.");
    } finally {
      setLoading(false);
    }
  };

  // Asignar
  const handleAssign = async () => {
    if (!selectedUser) {
      setError("Selecciona un ejecutivo comercial.");
      return;
    }
    if (!preview?.found?.length) {
      setError("No hay RUCs válidos para asignar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        rucs: preview.found.map((f) => f.ruc),
        userId: selectedUser,
        allowReassign,
        note: note?.trim() || "",
      };
      const { data } = await api.post("/basesecodi/assign", payload, authHeader);
      setAssignResult(data || null);
      // (opcional) limpia el textarea después de asignar
      // setRawRucs(""); setPreview(null);
    } catch (e) {
      console.error(e);
      // Si ves 401 aquí, revisa verifyToken / JWT en backend
      setError("Error al asignar RUCs.");
    } finally {
      setLoading(false);
    }
  };

  const copyList = (items = []) => {
    try {
      const text = (items || []).join("\n");
      navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-xl font-bold uppercase text-gray-800">
        Asignar RUCs a ejecutivos (Comercial)
      </h1>

      {/* Selección de ejecutivo */}
      <div className="grid gap-2">
        <label className="text-sm font-medium text-gray-700">
          Selecciona ejecutivo comercial
        </label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="">-- Selecciona --</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} {u.role?.nombre ? `(${u.role.nombre})` : ""}
            </option>
          ))}
        </select>
        {!users.length && (
          <p className="text-xs text-amber-700">
            No se encontraron usuarios activos con rol Comercial.
          </p>
        )}
      </div>

      {/* Entrada RUCs */}
      <div className="grid gap-2">
        <label className="text-sm font-medium text-gray-700">
          Ingresa RUCs (uno por línea o separados por coma)
        </label>
        <textarea
          rows={6}
          value={rawRucs}
          onChange={(e) => setRawRucs(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
          placeholder={`Ejemplo:
20123456789
20567891234
...`}
        />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowReassign}
              onChange={(e) => setAllowReassign(e.target.checked)}
            />
            Permitir re-asignar si ya tienen dueño
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota del lote (opcional)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-3">
        <button
          onClick={handlePreview}
          disabled={loading}
          className="px-4 py-2 bg-blue-700 text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Previsualizar"}
        </button>

        <button
          onClick={handleAssign}
          disabled={loading || !preview?.found?.length || !selectedUser}
          className="px-4 py-2 bg-green-700 text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          Asignar
        </button>
      </div>

      {/* Error */}
      {error && <div className="text-red-700 text-sm">{error}</div>}

      {/* Previsualización */}
      {preview && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Previsualización</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-green-700">
                  Encontrados ({preview.found.length})
                </h3>
                {!!preview.found.length && (
                  <button
                    onClick={() => copyList(preview.found.map((x) => x.ruc))}
                    className="text-xs px-2 py-1 border rounded"
                  >
                    Copiar RUCs
                  </button>
                )}
              </div>
              <ul className="text-sm border rounded p-2 max-h-60 overflow-y-auto">
                {preview.found.map((f) => (
                  <li key={f.ruc}>
                    {f.ruc} — {f.razonSocial || "Sin razón social"}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-red-700">
                  No encontrados ({preview.missing.length})
                </h3>
                {!!preview.missing.length && (
                  <button
                    onClick={() => copyList(preview.missing)}
                    className="text-xs px-2 py-1 border rounded"
                  >
                    Copiar lista
                  </button>
                )}
              </div>
              <ul className="text-sm border rounded p-2 max-h-60 overflow-y-auto">
                {preview.missing.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Resultado Asignación */}
      {assignResult && (
        <div className="space-y-3 border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Resultado de Asignación
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-3">
              <div className="text-gray-500 text-[11px] uppercase">Coincidencias</div>
              <div className="text-xl font-bold">{assignResult.matched ?? 0}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-gray-500 text-[11px] uppercase">Modificados</div>
              <div className="text-xl font-bold">{assignResult.modified ?? 0}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-gray-500 text-[11px] uppercase">Faltantes</div>
              <div className="text-xl font-bold">{assignResult.missing?.length ?? 0}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-gray-500 text-[11px] uppercase">Conflictos</div>
              <div className="text-xl font-bold">{assignResult.conflicted?.length ?? 0}</div>
            </div>
          </div>

          {(assignResult.missing?.length || assignResult.conflicted?.length) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!!assignResult.missing?.length && (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-red-700">
                      Faltantes ({assignResult.missing.length})
                    </h3>
                    <button
                      onClick={() => copyList(assignResult.missing)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Copiar
                    </button>
                  </div>
                  <ul className="text-sm border rounded p-2 max-h-60 overflow-y-auto">
                    {assignResult.missing.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!assignResult.conflicted?.length && (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-amber-700">
                      Conflictos ({assignResult.conflicted.length})
                    </h3>
                    <button
                      onClick={() => copyList(assignResult.conflicted)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Copiar
                    </button>
                  </div>
                  <ul className="text-sm border rounded p-2 max-h-60 overflow-y-auto">
                    {assignResult.conflicted.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
