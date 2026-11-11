import { createContext, useContext } from "react";
import type { FestiveThemeOption, ThemeId } from "./themes";

export interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  options: FestiveThemeOption[];
  isFestive: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useFestiveTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useFestiveTheme deve ser usado dentro de um <ThemeProvider>.",
    );
  }

  return context;
}
