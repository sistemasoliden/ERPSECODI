const KEY = "theme"; // 'light' | 'dark' | 'auto'

function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = theme === "dark" || (theme === "auto" && prefersDark);
  root.classList.toggle("dark", useDark);
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function getTheme() {
  return localStorage.getItem(KEY) || "auto";
}

export function initTheme() {
  applyTheme(getTheme());
  // si está en 'auto', reacciona a cambios del SO
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => getTheme() === "auto" && applyTheme("auto");
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}
