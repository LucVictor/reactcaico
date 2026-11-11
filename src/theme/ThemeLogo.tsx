interface ThemeLogoProps {
  src: string;
  alt?: string;
  width?: number;
  className?: string;
}

/** Logo do sistema com os enfeites do tema festivo ativo. */
export function ThemeLogo({
  src,
  alt = "Caicó Distribuidora",
  width,
  className = "",
}: ThemeLogoProps) {
  return (
    <span className={`theme-logo ${className}`.trim()}>
      <img src={src} alt={alt} width={width} />
      <span className="theme-logo__hat" aria-hidden="true" />
      <span className="theme-logo__sparkle" aria-hidden="true">
        ✦
      </span>
    </span>
  );
}
