import { DropdownDivider, DropdownHeader, DropdownItem } from "flowbite-react";
import { useFestiveTheme } from "./themeContext";

/** Itens de seleção de tema para o dropdown do usuário. */
export function ThemeMenuItems() {
  const { theme, setTheme, options } = useFestiveTheme();

  return (
    <>
      <DropdownDivider />
      <DropdownHeader>Tema festivo</DropdownHeader>

      {options.map((option) => (
        <DropdownItem
          key={option.id}
          onClick={() => setTheme(option.id)}
          title={option.description}
        >
          <span className="flex w-full items-center justify-between gap-6">
            <span>
              {option.emoji} {option.label}
            </span>
            {theme === option.id && (
              <span className="text-green-500" aria-label="Tema ativo">
                ✓
              </span>
            )}
          </span>
        </DropdownItem>
      ))}
    </>
  );
}
