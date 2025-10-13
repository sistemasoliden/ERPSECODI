import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const user = JSON.parse(localStorage.getItem("user"));

  const renderLanding = () => (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 min-h-screen">
      <section className="flex flex-col items-center justify-center text-center py-16 px-6">
        <h1 className="text-5xl md:text-6xl font-extrabold text-blue-800 mb-4">
          Bienvenido a ERP SECODI
        </h1>
        <p className="mt-4 text-lg md:text-xl text-gray-700 max-w-3xl leading-relaxed">
          La solución ERP integral que transforma la gestión de tu empresa. Automatiza ventas, inventario, 
          finanzas y recursos humanos con una plataforma intuitiva y segura.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-block bg-blue-700 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-blue-800 transition"
        >
          Inicia Sesión
        </Link>
      </section>

      <section className="py-16 bg-white">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-12">Nuestros Servicios</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6">
          <div className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-blue-700 mb-2">Gestión Integral</h3>
            <p className="text-gray-600">
              Administra todas las áreas de tu negocio en un solo lugar: ventas, compras, RRHH y más.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-blue-700 mb-2">Reportes en Tiempo Real</h3>
            <p className="text-gray-600">
              Visualiza datos actualizados para tomar decisiones estratégicas rápidamente.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-blue-700 mb-2">Soporte Premium</h3>
            <p className="text-gray-600">
              Nuestro equipo especializado te acompaña en cada paso para garantizar el éxito.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-blue-700 mb-2">Seguridad Avanzada</h3>
            <p className="text-gray-600">
              Datos protegidos con los más altos estándares de seguridad y cifrado.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-blue-700 mb-2">Integración API</h3>
            <p className="text-gray-600">
              Conecta fácilmente con otras plataformas y herramientas que ya utilizas.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg shadow-md p-6 hover:shadow-xl transition">
            <h3 className="text-xl font-bold text-blue-700 mb-2">Escalabilidad</h3>
            <p className="text-gray-600">
              Diseñado para crecer con tu empresa, desde startups hasta corporativos.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-r from-blue-100 to-blue-200">
        <h2 className="text-3xl font-bold text-center text-blue-800 mb-12">¿Por qué elegir SECODI?</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto px-6">
          <div className="text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h4 className="text-xl font-semibold text-blue-700 mb-2">Rápido</h4>
            <p className="text-gray-600">Implementación ágil y resultados inmediatos.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h4 className="text-xl font-semibold text-blue-700 mb-2">Seguro</h4>
            <p className="text-gray-600">Protección de datos con estándares internacionales.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4">🌐</div>
            <h4 className="text-xl font-semibold text-blue-700 mb-2">Conectado</h4>
            <p className="text-gray-600">Integración con plataformas líderes del mercado.</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-4">💡</div>
            <h4 className="text-xl font-semibold text-blue-700 mb-2">Innovador</h4>
            <p className="text-gray-600">Tecnología de vanguardia para tu negocio.</p>
          </div>
        </div>
      </section>

      <footer className="bg-gray-800 text-white py-6 text-center">
        <p>© 2025 ERP SECODI - Todos los derechos reservados</p>
        <p className="mt-2 text-sm text-gray-400">
          contacto@claronegocios-secodi.com | +51 999 888 777
        </p>
      </footer>
    </div>
  );

  const renderDashboard = () => {
  const message = {
    sistemas: "Bienvenido Sistemas - Tienes control total 🔥",
    gerencia: "Bienvenido Gerencia - Visualiza reportes clave 📊",
    backoffice: "Bienvenido Backoffice - Administra operaciones 📦",
    postventa: "Bienvenido Postventa - Gestiona la atención al cliente 📞",
    recursoshumanos: "Bienvenido RRHH - Gestiona el talento humano 👥",
    comercial: "Bienvenido Comercial - Administra oportunidades 💼",
    administracion: "Bienvenido Administración - Gestiona recursos y finanzas 💰", // ✅ NUEVO
  }[user.role] || "Bienvenido a ERP SECODI";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      <h1 className="text-5xl font-bold text-blue-700 mb-4">{message}</h1>
      <p className="mt-2 text-lg text-gray-600 max-w-xl">
        Aquí puedes gestionar todas las herramientas y recursos según tu perfil. Explora las opciones en el menú superior.
      </p>
    </div>
  );
};

return user ? renderDashboard() : renderLanding();

}
