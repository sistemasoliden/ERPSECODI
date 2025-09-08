// src/pages/DashboardEjecutives.jsx
import React from "react";
import { Wrench } from "lucide-react"; // 👈 icono bonito

export default function DashboardEjecutives() {
  return (
    <div className="min-h-[calc(100vh-88px)] flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="text-center px-6 py-12 max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-blue-100 p-6 shadow-inner dark:bg-blue-900/40">
            <Wrench className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin-slow" />
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-3">
          🚧 Página en mantenimiento
        </h1>

        <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
          Estamos trabajando para mejorar tu experiencia.  
          Vuelve a intentarlo más tarde.  
        </p>

        <div className="mt-6">
          <button
            onClick={() => (window.location.href = "/")}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-all"
          >
            ⬅ Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
