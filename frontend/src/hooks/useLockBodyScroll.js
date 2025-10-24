import { useEffect } from "react";

export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return;

    // Guarda la posición actual
    const scrollY = window.scrollY;
    const { body } = document;

    // Fija el body para que no se mueva (evita el “layout shift” al cerrar)
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    // iOS Safari: evita overscroll
    const preventTouch = (e) => e.preventDefault();
    document.addEventListener("touchmove", preventTouch, { passive: false });

    return () => {
      // Restaura estilos
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.overflow = "";
      document.removeEventListener("touchmove", preventTouch);

      // Vuelve a la misma posición de scroll
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
