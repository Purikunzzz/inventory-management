import { createContext, useContext, useState, useEffect, useCallback } from "react";

const THEME_KEY = "lab_theme";
const FONTSIZE_KEY = "lab_fontsize";

const VALID_THEMES = ["light", "dark", "warm", "cool", "system"];
const DEFAULT_THEME = "light";
const DEFAULT_FONTSIZE = 16;

function getSystemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolveTheme(themeId) {
  if (themeId === "system") {
    return getSystemPrefersDark() ? "dark" : "light";
  }
  return themeId;
}

function loadFromLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function applyThemeToDOM(themeId, fontSize) {
  const resolved = resolveTheme(themeId);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.fontSize = `${fontSize}px`;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = loadFromLS(THEME_KEY, DEFAULT_THEME);
    return VALID_THEMES.includes(stored) ? stored : DEFAULT_THEME;
  });

  const [fontSize, setFontSizeState] = useState(() => {
    const stored = loadFromLS(FONTSIZE_KEY, DEFAULT_FONTSIZE);
    const num = Number(stored);
    return num >= 12 && num <= 24 ? num : DEFAULT_FONTSIZE;
  });

  // Apply theme + font size on mount and whenever they change
  useEffect(() => {
    applyThemeToDOM(theme, fontSize);
  }, [theme, fontSize]);

  // Listen for system theme changes when "system" is selected
  useEffect(() => {
    if (theme !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeToDOM("system", fontSize);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme, fontSize]);

  const setTheme = useCallback((newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(newTheme));
    } catch {}
  }, []);

  const setFontSize = useCallback((newSize) => {
    const num = Number(newSize);
    if (num < 12 || num > 24) return;
    setFontSizeState(num);
    try {
      localStorage.setItem(FONTSIZE_KEY, JSON.stringify(num));
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, fontSize, setTheme, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
