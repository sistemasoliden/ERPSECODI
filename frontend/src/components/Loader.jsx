// src/components/Loader.jsx
import React from "react";
import clsx from "clsx";

export function Loader({
  variant = "container",
  message = "Cargando…",
  className = "",
  size = "lg",
  blur = false,
  minHeight = 320,
  navbarHeight = 88, // ⬅️ nuevo prop para dejar espacio del navbar
}) {
  const sizeMap = {
    sm: "h-6 w-6 border-t-2",
    md: "h-10 w-10 border-t-4",
    lg: "h-14 w-14 border-t-4",
  };

  if (variant === "inline") {
    return (
      <span className={clsx("inline-flex items-center gap-2", className)}>
        <span
          className={clsx(
            "animate-spin rounded-full border-blue-500 border-solid",
            sizeMap.sm
          )}
        />
        <span className="text-sm text-black dark:text-white">{message}</span>
      </span>
    );
  }

  const Content = (
    <div className="flex flex-col items-center justify-center text-center">
      <div
        className={clsx(
          "animate-spin rounded-full border-solid mb-4 border-blue-500",
          sizeMap[size]
        )}
      />
      {message && (
        <p className="text-base font-semibold text-black dark:text-white">
          {message}
        </p>
      )}
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div
        className={clsx(
          "fixed left-0 right-0 bottom-0 z-[60] flex items-center justify-center",
          "bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm",
          className
        )}
        style={{ top: navbarHeight }} // respeta altura del navbar
      >
        {Content}
      </div>
    );
  }

  // container
  return (
    <div
      className={clsx(
        "p-6 w-full flex items-center justify-center text-center px-6",
        blur && "backdrop-blur-sm",
        className
      )}
      style={{ minHeight: minHeight || 400 }}
    >
      {Content}
    </div>
  );
}

export function Skeleton({ className = "", lines = 0 }) {
  if (lines > 0) {
    return (
      <div className={clsx("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={clsx(
        "animate-pulse rounded bg-neutral-200 dark:bg-neutral-700",
        className
      )}
    />
  );
}
