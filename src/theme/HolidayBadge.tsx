import { useFestiveTheme } from "./themeContext";
import { getNewYear } from "./themes";

interface HolidayBadgeProps {
  className?: string;
}

/** Selo com o cumprimento do tema festivo ativo. */
export function HolidayBadge({ className = "" }: HolidayBadgeProps) {
  const { theme } = useFestiveTheme();

  if (theme === "none") return null;

  const isNatal = theme === "natal";

  return (
    <span className={`theme-holiday-badge ${className}`.trim()}>
      <span className="theme-holiday-badge__icon" aria-hidden="true">
        {isNatal ? "🎄" : "🎆"}
      </span>
      {isNatal ? "Feliz Natal" : `Feliz ${getNewYear()}`}
    </span>
  );
}
