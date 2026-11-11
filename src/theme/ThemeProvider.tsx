import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_THEME_ID,
  FESTIVE_THEMES,
  THEME_STORAGE_KEY,
  isThemeId,
  type ThemeId,
} from "./themes";
import { ThemeContext, type ThemeContextValue } from "./themeContext";

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

function updateDocumentBranding(theme: ThemeId) {
  const isNatal = theme === "natal";
  const isAnoNovo = theme === "ano-novo";

  document.title = isNatal
    ? "🎄 Estoque Caicó"
    : isAnoNovo
      ? "🎆 Estoque Caicó"
      : "Estoque Caicó";

  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) return;

  if (theme === "none") {
    icon.href = "/vite.svg";
    return;
  }

  const emoji = isNatal ? "🎄" : "🎆";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
  icon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    updateDocumentBranding(theme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage indisponível (modo privado, por exemplo): segue sem persistir.
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      options: FESTIVE_THEMES,
      isFestive: theme !== "none",
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
