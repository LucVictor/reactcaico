import type { CSSProperties } from "react";
import { useFestiveTheme } from "./themeContext";
import { getNewYear } from "./themes";

const GARLAND_BULBS = 28;
const GARLAND_COLORS = [
  "#e63946",
  "#f1c40f",
  "#22c55e",
  "#3b82f6",
  "#f97316",
  "#ffffff",
];

const TREE_LIGHTS = [
  { left: "24%", bottom: "38px", color: "#f6c445", delay: "0s" },
  { left: "68%", bottom: "46px", color: "#ef4444", delay: "0.5s" },
  { left: "42%", bottom: "64px", color: "#f6c445", delay: "1s" },
  { left: "60%", bottom: "24px", color: "#22c55e", delay: "1.4s" },
  { left: "38%", bottom: "92px", color: "#ef4444", delay: "0.8s" },
];

const FIREWORK_BURSTS = [
  { x: 16, y: 24, delay: 0, color: "#facc15", scale: 1 },
  { x: 44, y: 16, delay: 1.1, color: "#38bdf8", scale: 0.85 },
  { x: 72, y: 28, delay: 2.2, color: "#f472b6", scale: 1.1 },
  { x: 88, y: 56, delay: 3, color: "#4ade80", scale: 0.8 },
  { x: 30, y: 58, delay: 1.7, color: "#f97316", scale: 0.75 },
];

const PARTICLES_PER_BURST = 12;

function ChristmasTree() {
  return (
    <div className="fx-tree">
      <span className="fx-tree__star">★</span>
      <span className="fx-tree__trunk" />
      <span className="fx-tree__layer fx-tree__layer--1" />
      <span className="fx-tree__layer fx-tree__layer--2" />
      <span className="fx-tree__layer fx-tree__layer--3" />

      {TREE_LIGHTS.map((light, index) => (
        <span
          key={index}
          className="fx-tree__light"
          style={
            {
              left: light.left,
              bottom: light.bottom,
              "--bulb-color": light.color,
              "--bulb-delay": light.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function NatalEffects() {
  return (
    <>
      <div className="fx-aurora" />
      <div className="fx-snow" />
      <div className="fx-snowbank" />
      <ChristmasTree />

      <div className="fx-garland">
        {Array.from({ length: GARLAND_BULBS }).map((_, index) => {
          const progress = index / (GARLAND_BULBS - 1);
          const drop = Math.sin(progress * Math.PI) * 12;

          return (
            <span
              key={index}
              className="fx-garland__bulb"
              style={
                {
                  "--bulb-color": GARLAND_COLORS[index % GARLAND_COLORS.length],
                  "--bulb-delay": `${(index % 6) * 0.32}s`,
                  "--bulb-drop": `${drop}px`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>

      <div className="fx-greeting">
        <span className="fx-greeting__spark">✦</span>
        Feliz Natal
        <span className="fx-greeting__spark">✦</span>
      </div>
    </>
  );
}

function AnoNovoEffects() {
  return (
    <>
      <div className="fx-aurora" />
      <div className="fx-stars" />

      <div className="fx-fireworks">
        {FIREWORK_BURSTS.map((burst, burstIndex) => (
          <div
            key={burstIndex}
            className="fx-firework"
            style={
              {
                "--fw-x": `${burst.x}%`,
                "--fw-y": `${burst.y}%`,
                "--fw-delay": `${burst.delay}s`,
                "--fw-color": burst.color,
                "--fw-scale": burst.scale,
              } as CSSProperties
            }
          >
            {Array.from({ length: PARTICLES_PER_BURST }).map(
              (_, particleIndex) => (
                <span
                  key={particleIndex}
                  style={
                    {
                      "--particle-angle": `${
                        (360 / PARTICLES_PER_BURST) * particleIndex
                      }deg`,
                    } as CSSProperties
                  }
                />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="fx-greeting">
        <span className="fx-greeting__spark">✦</span>
        Feliz {getNewYear()}!<span className="fx-greeting__spark">✦</span>
      </div>
    </>
  );
}

/** Camada visual global do tema festivo ativo. */
export function ThemeEffects() {
  const { theme } = useFestiveTheme();

  if (theme === "none") return null;

  return (
    <div className={`theme-effects theme-effects--${theme}`} aria-hidden="true">
      {theme === "natal" ? <NatalEffects /> : <AnoNovoEffects />}
    </div>
  );
}
