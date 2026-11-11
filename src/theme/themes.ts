export type ThemeId = "natal" | "ano-novo" | "none";

export interface FestiveThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  emoji: string;
}

/**
 * Temas festivos disponíveis no sistema.
 * Para criar um novo tema, adicione uma opção aqui e os estilos
 * correspondentes em `theme.css` usando `html[data-theme="<id>"]`.
 */
export const FESTIVE_THEMES: FestiveThemeOption[] = [
  {
    id: "natal",
    label: "Natal",
    description: "Neve, luzes e brilho natalino",
    emoji: "🎄",
  },
  {
    id: "ano-novo",
    label: "Ano Novo",
    description: "Fogos, estrelas e dourado",
    emoji: "🎆",
  },
  {
    id: "none",
    label: "Desativado",
    description: "Visual padrão do sistema",
    emoji: "🚫",
  },
];

/** Tema aplicado quando o usuário ainda não escolheu nenhum. */
export const DEFAULT_THEME_ID: ThemeId = "natal";

export const THEME_STORAGE_KEY = "caico:festive-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return FESTIVE_THEMES.some((theme) => theme.id === value);
}

export function getThemeOption(id: ThemeId): FestiveThemeOption {
  return FESTIVE_THEMES.find((theme) => theme.id === id) ?? FESTIVE_THEMES[0];
}

/** Ano que será celebrado na virada (dezembro já aponta para o ano seguinte). */
export function getNewYear(date = new Date()): number {
  return date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
}
