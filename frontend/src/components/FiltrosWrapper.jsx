// src/components/FiltrosWrapper.jsx
import { useEffect, useState } from "react";
import EstadoVentaFilter from "./EstadoVentaFilter";

export default function FiltrosWrapper({ children, onChangeFilters }) {
  const [estado, setEstado] = useState([]);       // ["Aprobado", "Pendiente"]
  const [anio, setAnio] = useState([]);           // [2023, 2024]
  const [mes, setMes] = useState([]);             // [1,2,3]
  const [tipoVenta, setTipoVenta] = useState([]); // ["Alta Nueva"...]
  const [soloPdv, setSoloPdv] = useState(false);

  const handleClear = () => {
    setEstado([]);
    setAnio([]);
    setMes([]);
    setTipoVenta([]);
    setSoloPdv(false);
  };

  // 🔔 Notifica al padre cada vez que cambie algún filtro
  useEffect(() => {
    onChangeFilters?.({ estado, anio, mes, tipoVenta, soloPdv });
  }, [estado, anio, mes, tipoVenta, soloPdv, onChangeFilters]);

  return (
    <div className="space-y-4">
      <EstadoVentaFilter
        value={estado}
        onChange={setEstado}
        yearValue={anio}
        onChangeYear={setAnio}
        monthValue={mes}
        onChangeMonth={setMes}
        tipoVentaValue={tipoVenta}
        onChangeTipoVenta={setTipoVenta}
        pdvOnly={soloPdv}
        onChangePdvOnly={setSoloPdv}
        onClear={handleClear}
      />
      {/* Puedes ignorar el argumento si no lo necesitas */}
      <div>{children?.({ estado, anio, mes, tipoVenta, soloPdv })}</div>
    </div>
  );
}
